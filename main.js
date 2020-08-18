// Target framerate
const kTargetFrameRate = 60;
const kTargetPeriodMs = 1000 / kTargetFrameRate;

// pixels / meter 
const kPxPerMeter = 1/100;

// g
const kG = 9.81;
const kMass = 1 / 150;
// Higher is slower
const kTimeScale = 30;

// Rough approximation of lift as a function of aoa.
function aoaToLiftCoef(aoa) {
    if (aoa > 18) {
        return 0;
    }
    if (aoa < -5) {
        return 0;
    }
    let cl = -0.005 * aoa * (aoa - 30) + 0.5;
    return Math.max(cl, 0);
}

const kDrag = 1 / 100000000;
const kLift = 1 / 5000000;
class Plane {
    constructor(height, width) {
        this.x = 0;
        // Positive y is in the down direction.
        this.y = 0;
        // Some initial velocity is necessary so the plan can generate lift.
        this.vX = 1500;
        this.vY = 0;
        // Position relative to the horizon, where positive is clockwise.
        this.theta = Math.atan(this.vY/this.vX);
        // Angular velocity 
        this.omega = 0;

        //
        // The following members are used for display purposes only, and do not affect the similation.
        //

        // Velocity direction relative to the horizon, where positive is clockwise.
        this.vMag = 0;
        this.vDir = 0;
        this.wing = {
            armElement: document.getElementById("wing-arm"),
            areaElement: document.getElementById("wing-area"),
            trimElement: document.getElementById("wing-trim"),
            force: 0,
            angleOfAttack: 0,
            stall: false,
        };
        this.stab = {
            armElement: document.getElementById("stab-arm"),
            areaElement: document.getElementById("stab-area"),
            trimElement: document.getElementById("stab-trim"),
            force: 0,
            angleOfAttack: 0,
            stall: false,
        };
        this.body = {
            momentElement: document.getElementById("moment"),
            dragForce: 0,
            gravForce: 0,
            forceX: 0,
            forceY: 0,
        };
        // TODO: This doesn't scale appropriately
        this.altitude = 10000;
        this.canvasHeight = height;
        this.canvasWidth = width;
    }
    draw(globalCtx) {
        const kScale = 10;

        let x = globalCtx.width / 2;
        let y = globalCtx.height / 2;
        // let x = kPxPerMeter * this.x;
        // let y = kPxPerMeter * this.y;
        // About origin
        let shape = [
            [-2, -0.5],
            [2, -0.5],
            [3, 0],
            [3, 1],
            [-5, 1],
            [-5, -1.5],
            [-4, -1.5],
            [-4, -0.5],
            [-1, -0.5],
        ];

        let drawCtx = globalCtx.drawCtx;
        drawCtx.fillStyle = "#000";
        drawCtx.strokeStyle = "#000";
        let theta = this.theta;
        let scaled = scalePoints(shape, kScale);
        let rotated = rotatePoints(scaled, theta);
        drawPolygonAtPoint(drawCtx, rotated, x, y);
        drawCtx.strokeStyle = "#ff0000";
        drawCtx.fillStyle = "#ff0000";
        drawCircle(drawCtx, x, y, 2);
        drawCtx.fill();

        let wingArm = this.wing.armElement.value / 10;
        let stabArm = this.stab.armElement.value / 10;

        let wingRotated = rotatePoint(scalePoint([wingArm, 0], kScale), theta);
        drawCircle(drawCtx, wingRotated[0] + x, wingRotated[1] + y, 2);
        let stabRotated = rotatePoint(scalePoint([stabArm, 0], kScale), theta);
        drawCircle(drawCtx, stabRotated[0] + x, stabRotated[1] + y, 2);

        drawCtx.strokeStyle = "#0000ff";

        // Draw force vectors.
        let dir = Math.atan(this.vY/this.vX);
        let dragForce = rotatePoint(scalePoint([- this.body.dragForce * 100, 0], kScale), dir);
        drawLine(drawCtx, [x, y], [dragForce[0] + x, dragForce[1] + y]);
        let wingForce = rotatePoint(scalePoint([wingArm, - this.wing.force * 100], kScale), theta);
        drawLine(drawCtx, [wingRotated[0] + x, wingRotated[1] + y], [wingForce[0] + x, wingForce[1] + y]);
        let stabForce = rotatePoint(scalePoint([stabArm, this.stab.force * 100], kScale), theta);
        drawLine(drawCtx, [stabRotated[0] + x, stabRotated[1] + y], [stabForce[0] + x, stabForce[1] + y]);
        let gravForce = scalePoint([0, this.body.gravForce * 100], kScale);
        drawLine(drawCtx, [x, y], [gravForce[0] + x, gravForce[1] + y]);

        drawCtx.strokeStyle = "#00ff00";
        let fX  = scalePoint([this.body.forceX * 100, 0], kScale);
        drawLine(drawCtx, [x, y], [fX[0] + x, fX[1] + y]);
        let fY  = scalePoint([0, this.body.forceY * 100], kScale);
        drawLine(drawCtx, [x, y], [fY[0] + x, fY[1] + y]);


        drawCtx.fillStyle = "#000";
        // drawCtx.fillText('altitude: ' + Number.parseFloat(this.altitude).toFixed(1), 0, 10);
        drawCtx.fillText('Vel: ' + Number.parseFloat(this.vMag).toFixed(1), 0, 20);
        drawCtx.fillText('Vel dir: ' + Number.parseFloat(180 * this.vDir / Math.PI).toFixed(1), 0, 30);

        let wingAoa = 'aoa (wing): ' + Number.parseFloat(this.wing.angleOfAttack).toFixed(1);
        if (this.wing.stall) {
            drawCtx.fillStyle = "#f00";
            wingAoa += ' STALL';
        } else {
            drawCtx.fillStyle = "#000";
        }
        drawCtx.fillText(wingAoa, 0, 40);

        let stabAoa = 'aoa (stab): ' + Number.parseFloat(this.stab.angleOfAttack).toFixed(1);
        if (this.stab.stall) {
            stabAoa += ' STALL';
            drawCtx.fillStyle = "#f00";
        } else {
            drawCtx.fillStyle = "#000";
        }
        drawCtx.fillText(stabAoa, 0, 50);
    }
    step(globalCtx) {
        // Get input values.
        let scale = 1000    ;
        let moment = this.body.momentElement.value / scale;
        let wingArm = this.wing.armElement.value / scale;
        let wingArea = this.wing.areaElement.value / scale;
        let wingTrim = parseFloat(this.wing.trimElement.value); 
        let stabArm = this.stab.armElement.value / scale;
        let stabArea = this.stab.areaElement.value / scale;
        let stabTrim = parseFloat(this.stab.trimElement.value); 

        // Calculate important constants from inputs.
        let kLiftWing = kLift * wingArea;
        let kLiftStab = kLift * stabArea;
        let kI = 1 / moment; 

        // Calculate instantaneous force magntitudes from each component (body, wing, stab)
        
        let vMag = mag([this.vX, this.vY]);
        let vDir = Math.atan(this.vY / this.vX);

        // The angle of attack is the difference in direction between the direction the plane is facing, theta, and the velocity vector direction. 
        let angleOfAttack = vDir - this.theta;
        let angleOfAttackDeg = 180 * angleOfAttack / Math.PI;

        // The velocity magnitude is used because the angle of attack accounts for non-direct wind incidence.
        let wingForce = aoaToLiftCoef(angleOfAttackDeg + wingTrim) * kLiftWing * Math.pow(vMag, 2);
        let stabForce = aoaToLiftCoef(angleOfAttackDeg + stabTrim) * kLiftStab * Math.pow(vMag, 2);
        if (wingForce == 0) {
            this.wing.stall = true;
        }
        if (stabForce == 0) {
            this.stab.stall = true;
        }

        let dragForce = kDrag * Math.pow(vMag, 2);
        let gravForce = kG * kMass;

        // Apply forces for each compontent about moment arm to create rotation. Gravity is ignored because it is applied at the center of gravity.
        this.omega = this.omega +
                     (kI * ((stabForce * stabArm) - (wingForce * wingArm)) * globalCtx.dt);
        // NOTE: Positive y is down, so theta increases CLOCKWISE 
        this.theta = this.theta +
                     (this.omega * globalCtx.dt);
        this.theta = this.theta % (2 * Math.PI);

        // Apply sum of forces in X and Y directions to calculate velocity and translation 
        let forceX = (wingForce * Math.cos(this.theta - Math.PI/2)) - 
                     (stabForce * Math.cos(this.theta - Math.PI/2)) -
                     // Drag is applied opposite the velocity vector, not the positiion vector, theta.
                     (dragForce * Math.cos(vDir));
        let forceY = (gravForce) - 
                     (stabForce * Math.sin(this.theta - Math.PI/2)) +
                     (wingForce * Math.sin(this.theta - Math.PI/2)) - 
                     // Drag is applied opposite the velocity vector, not the positiion vector, theta.
                     (dragForce * Math.sin(vDir));

        this.vX = this.vX +
                  (forceX / kMass) * (globalCtx.dt);
        this.vY = this.vY +
                  (forceY / kMass) * (globalCtx.dt);
        this.x = this.x +
                 (this.vX * globalCtx.dt);
        this.y = this.y +
                 (this.vY * globalCtx.dt);

        // The following are set for display purposes only, and have no affect on the similation. 

        this.altitude = (200000 - this.y) / 10;
        if (this.altitude <= 0) {
            // throw "crash";
        }
        this.vMag = vMag;
        this.vDir = vDir;
        this.wing.force = wingForce;
        this.wing.angleOfAttack = angleOfAttackDeg + wingTrim;
        this.stab.force = stabForce;
        this.stab.angleOfAttack = angleOfAttackDeg + stabTrim;
        this.body.gravForce = gravForce;
        this.body.dragForce = dragForce;
        this.body.forceX = forceX;
        this.body.forceY = forceY;
    }
}

class Ruler {
    constructor() {
        this.lineStep = 100;
    }
    draw(globalCtx) {
        let drawCtx = globalCtx.drawCtx;
        drawCtx.strokeStyle = "#000000";
        drawCtx.fillStyle = "#000000";
        let plane = globalCtx.assets["plane"];

        let planeX = plane.x * kPxPerMeter;
        // Plane is centered, starting line is at far left. Only draw increments of 100;
        let firstLineX = -planeX + globalCtx.width/2;
        let skipX = - Math.ceil(firstLineX / this.lineStep);
        let lineX = firstLineX + (skipX * this.lineStep);
        while (lineX < globalCtx.width) {
            drawLine(drawCtx, [lineX, globalCtx.height], [lineX, globalCtx.height - 30]);
            drawCtx.fillText(Number.parseFloat(lineX + planeX -globalCtx.width/2).toFixed(1), lineX + 5,  globalCtx.height - 10);
            lineX += this.lineStep;
        }

        drawCtx.strokeStyle = "#bbb";
        let planeY = plane.y * kPxPerMeter;
        let firstLineY = -planeY + globalCtx.height/2;
        let skipY = - Math.ceil(firstLineY / this.lineStep);
        let lineY = firstLineY + (skipY * this.lineStep);
        while (lineY < globalCtx.height) {
            drawLine(drawCtx, [0, lineY], [globalCtx.width, lineY]);
            drawCtx.fillText(Number.parseFloat(-1* (lineY + planeY -globalCtx.height/2)).toFixed(1), globalCtx.width/2 - 150, lineY + 10);
            lineY += this.lineStep;
        }
    }
    step(globalCtx) {
    }
}

function makeGlobalContext(canvas) {
    // Set display size (css pixels).
    const controlsHeight = document.getElementById("controls").offsetHeight;
    const height = window.innerHeight - controlsHeight;
    const width = window.innerWidth;
    canvas.style.height = height + "px";
    canvas.style.width = width + "px";

    // Set actual size in memory (scaled to account for extra pixel density).
    var scale = window.devicePixelRatio;
    canvas.width = width * scale;
    canvas.height = height * scale;

    // Create context
    const drawCtx = canvas.getContext("2d");

    // Normalize coordinate system to use css pixels.
    drawCtx.scale(scale, scale);

    return {
        startTime: 0,
        timeMs: 0,
        t: 0,
        lastT: 0,
        dt: 0,
        assets: {
            plane: new Plane(),
            ruler: new Ruler(),
        },
        drawCtx: drawCtx,
        height: height,
        width: width,
    };
}
let globalCtx;

function step(drawCtx) {
    clear(drawCtx);
    for (let asset in globalCtx.assets) {
        globalCtx.assets[asset].step(globalCtx);
        globalCtx.assets[asset].draw(globalCtx);
    };
}

window.onload = () => {
    const canvas = document.getElementById("canvas");
    globalCtx = makeGlobalContext(canvas);

    // Reset by overwriting global context to default values, which holds all timing and position state.
    const resetBtn = document.getElementById("reset");
    resetBtn.onclick = () => {
        globalCtx = makeGlobalContext(canvas);
    };
    // Allow reset from pressing Enter
    document.addEventListener('keypress', (e) => {
        if (e.keyCode == 13) {
            globalCtx = makeGlobalContext(canvas);
        }
    });

    const wingArm = document.getElementById("wing-arm");
    const wingArmValue = document.getElementById("wing-arm-value");
    wingArmValue.innerHTML  = wingArm.value;
    wingArm.oninput = () => {
        wingArmValue.innerHTML  = wingArm.value;
    };

    const stabArm = document.getElementById("stab-arm");
    const stabArmValue = document.getElementById("stab-arm-value");
    stabArmValue.innerHTML  = stabArm.value;
    stabArm.oninput = () => {
        stabArmValue.innerHTML  = stabArm.value;
    };

    const wingArea = document.getElementById("wing-area");
    const wingAreaValue = document.getElementById("wing-area-value");
    wingAreaValue.innerHTML  = wingArea.value;
    wingArea.oninput = () => {
        wingAreaValue.innerHTML  = wingArea.value;
    };

    const stabArea = document.getElementById("stab-area");
    const stabAreaValue = document.getElementById("stab-area-value");
    stabAreaValue.innerHTML  = stabArea.value;
    stabArea.oninput = () => {
        stabAreaValue.innerHTML  = stabArea.value;
    };

    const moment = document.getElementById("moment");
    const momentValue = document.getElementById("moment-value");
    momentValue.innerHTML  = moment.value;
    moment.oninput = () => {
        momentValue.innerHTML  = moment.value;
    };

    const wingTrim = document.getElementById("wing-trim");
    const wingTrimValue = document.getElementById("wing-trim-value");
    wingTrimValue.innerHTML  = wingTrim.value;
    wingTrim.oninput = () => {
        wingTrimValue.innerHTML  = wingTrim.value;
    };

    const stabTrim = document.getElementById("stab-trim");
    const stabTrimValue = document.getElementById("stab-trim-value");
    stabTrimValue.innerHTML  = stabTrim.value;
    stabTrim.oninput = () => {
        stabTrimValue.innerHTML  = stabTrim.value;
    };

    run().catch((err) => {
        console.log(err);
    });
};
async function run() {
    let lastSec = 0;
    let frames = 0;
    let frameRate = 0;

    let ctx = globalCtx.drawCtx;

    while (true) {
        let start = new Date();
        if (globalCtx.startTime === 0) {
            globalCtx.startTime = start;
            globalCtx.t = 0;
            await sleep(kTargetPeriodMs);
            globalCtx.lastT = 0;
            continue;
        }

        globalCtx.timeMs = start - globalCtx.startTime;
        globalCtx.t = globalCtx.timeMs / kTimeScale;
        globalCtx.dt = globalCtx.t - globalCtx.lastT;

        step(ctx);

        // Count the number of frames per second, and only update every second.
        let thisSec = Math.floor(globalCtx.timeMs / 1000);
        if (thisSec == lastSec) {
            frames += 1;
        } else if (thisSec > lastSec) {
            frameRate = frames;
            frames = 0;
            lastSec = thisSec;
        }

        let height = globalCtx.height;
        ctx.font = "10px Arial";
        ctx.fillStyle = "#000000";
        ctx.fillText('fps: ' + frameRate, 5, height - 5);
        ctx.fillText('time (s): ' + (globalCtx.timeMs / 1000), 5, height - 15);
        ctx.fillText('t: ' + Number.parseFloat(globalCtx.t).toFixed(0), 5, height - 25);
        ctx.fillText('dt: ' + Number.parseFloat(globalCtx.dt).toFixed(1), 5, height - 35);

        globalCtx.lastT = globalCtx.t;
        let stepDuration = new Date() - start;
        let waitMs = kTargetPeriodMs - stepDuration;
        if (waitMs > 0) {
            await sleep(waitMs);
        }

        // await waitForKey(32); // space
    }
}

// Helpers
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForKey(keyCode) {
    return new Promise((resolve) => {
        let listener = function (e) {
            if (e.keyCode == keyCode) {
                resolve();
            }
        };
        document.addEventListener('keypress', listener, { once: true });
    });
}

function clear(ctx) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawCircle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.stroke();
}

function drawLine(ctx, a, b) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
}

function drawPolygonAtPoint(ctx, points, x, y) {
    ctx.beginPath();
    let first = true;
    points.forEach((p) => {
        if (first) {
            ctx.moveTo(p[0] + x, p[1] + y);
            first = false;
        } else {
            ctx.lineTo(p[0] + x, p[1] + y);
        }
    });

    ctx.stroke();
}

function rotatePoint(point, rad, x = 0, y = 0) {
    let Px = point[0] - x;
    let Py = point[1] - y;
    return [
        x + (Px * Math.cos(rad) - Py * Math.sin(rad)),
        y + (Py * Math.cos(rad) + Px * Math.sin(rad)),
    ];
}

function rotatePoints(points, deg, x, y) {
    let rotated = [];
    points.forEach((p) => {
        rotated.push(rotatePoint(p, deg, x, y));
    });
    return rotated;
}

function scalePoint(p, scale) {
    return [p[0] * scale, p[1] * scale];
}

function scalePoints(points, scale) {
    let scaled = [];
    points.forEach((p) => {
        scaled.push(scalePoint(p, scale));
    });
    return scaled;
}

function dot(a, b) {
    return (a[0] * b[0]) + (a[1] + b[1]);
}

function mag(a) {
    return Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2));
}

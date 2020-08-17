// Target framerate
const kTargetFrameRate = 60;
const kTargetPeriodMs = 1000 / kTargetFrameRate;

// pixels / meter 
const kPxPerMeter = 1/200;

// g
const kG = 9.81;
// air density kg/m^3
const rho = 1.225
const kWingArea = 1 / 500;
const kMass = 1 / 500;
// Higher is slower
const kTimeScale = 50;

// Rough approximation of lift as a function of aoa.
function aoaToLiftCoef(aoa) {
    if (aoa > 18) {
        return 0;
    }
    let cl = -0.005 * aoa * (aoa - 30) + 0.5;
    if (cl < 0) {
        return 0;
    }
    return cl;
}

class Ball {
    constructor() {
        this.x = 4000;
        this.y = 2200;
        this.vXi = 2000;
        this.vYi = -300;
        this.vX = 0;
        this.vY = 0;
    }
    draw(drawCtx) {
        const kScale = 20;

        let x = kPxPerMeter * this.x;
        let y = kPxPerMeter * this.y;
        // About origin

        drawCtx.fillStyle = "#000";
        drawCtx.strokeStyle = "#000";
        drawCircle(drawCtx, x, y, 10);
        drawCtx.fill();
    }
    step(globalCtx) {
        this.vX = this.vXi;
        this.vY = kG * globalCtx.t + this.vYi;

        this.x += this.vX * globalCtx.dt;
        this.y += this.vY * globalCtx.dt;
    }
}

const kDrag = 1 / 1000000;
const kLift = 1 / 10000000;
class Plane {
    constructor() {
        this.x = 10000;
        this.y = 5000;
        this.vX = 2000;
        this.vY = -100;
        this.C = (Math.atanh(mag([this.vX, this.vY]) * Math.sqrt(kLift/kG)))/(Math.sqrt(kG * kLift));
        this.wing = {
            arm: -1,
            aoa: 0,
        };
        this.stab = {
            arm: -4,
            aoa: -5,
        };
        this.angleFromHorizon = 0;
        this.aoa = 0;
    }
    draw(drawCtx) {
        const kScale = 10;

        let x = kPxPerMeter * this.x;
        let y = kPxPerMeter * this.y;
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

        drawCtx.fillStyle = "#000";
        drawCtx.strokeStyle = "#000";
        let theta = this.angleFromHorizon;
        let scaled = scalePoints(shape, kScale);
        let rotated = rotatePoints(scaled, theta);
        drawPolygonAtPoint(drawCtx, rotated, x, y);
        drawCtx.strokeStyle = "#ff0000";
        drawCtx.fillStyle = "#ff0000";
        drawCircle(drawCtx, x, y, 2);
        drawCtx.fill();

        let wingRotated = rotatePoint(scalePoint([this.wing.arm, 0], kScale), theta);
        drawCircle(drawCtx, wingRotated[0] + x, wingRotated[1] + y, 2);
        let stabRotated = rotatePoint(scalePoint([this.stab.arm, 0], kScale), theta);
        drawCircle(drawCtx, stabRotated[0] + x, stabRotated[1] + y, 2);

        drawCtx.fillStyle = "#000";
        drawCtx.fillText('Vy: ' + Number.parseFloat(this.vY).toFixed(1), 0, 10);
        drawCtx.fillText('Vx: ' + Number.parseFloat(this.vX).toFixed(1), 0, 20);
        let angleDeg = -180 * this.angleFromHorizon / Math.PI;
        drawCtx.fillText('angle from horizon: ' + Number.parseFloat(angleDeg).toFixed(1), 0, 30);
    }
    step(globalCtx) {
        // Calculate instantaneous force vectors from each component (body, wing, stab)
        // Apply forces for each compontent about moment arm to create rotation
        // Apply sum of forces in X and Y directions to calculate velocity and translation 

        this.angleFromHorizon = Math.atan(this.vY / this.vX);
        let theta = this.angleFromHorizon;
        // this.vX = 1 / ((1 / this.vXi) + (globalCtx.t * ((kDrag / Math.cos(theta)) - (kLift * Math.tan(theta) / Math.cos(theta)))));
        // this.vX = 1 / ((1 / this.vXi) + (globalCtx.t * ((kDrag / Math.cos(theta)))));
        // this.vX = 1 / ((1 / this.vXi) + (globalCtx.t * (kDrag)));
        let vel = (Math.sqrt(kG)*Math.tanh((this.C * Math.sqrt(kG * kLift)) + (Math.sqrt(kG * kLift) * globalCtx.t)))/Math.sqrt(kLift);
        this.vY = vel * Math.sin(theta);
        this.vX = vel * Math.cos(theta);
        this.angleFromHorizon = Math.atan(this.vY / this.vX);

        // this.vY = (Math.sqrt(kG)*Math.tanh(this.vYi * Math.sqrt(kG*kLift) + Math.sqrt(kG*kLift)*globalCtx.t))/(Math.sqrt(kLift));

        this.x += this.vX * globalCtx.dt;
        this.y += this.vY * globalCtx.dt;
    }
}

function makeGlobalContext() {
    return {
        startTime: 0,
        timeMs: 0,
        t: 0,
        lastT: 0,
        dt: 0,
        assets: [
            new Plane(),
        ]
    };
}
let globalCtx = makeGlobalContext();

function step(drawCtx) {
    clear(drawCtx);
    globalCtx.assets.forEach((asset) => {
        asset.step(globalCtx);
        asset.draw(drawCtx);
    });
}

window.onload = () => {
    // Reset by overwriting global context to default values, which holds all timing and position state.
    const resetBtn = document.getElementById("reset");
    resetBtn.onclick = () => {
        globalCtx = makeGlobalContext();
    };

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


    const canvas = document.getElementById("canvas");
    run(canvas);
};
async function run(canvas) {
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
    const ctx = canvas.getContext("2d");

    // Normalize coordinate system to use css pixels.
    ctx.scale(scale, scale);

    let frames = 0;
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

        frames += 1;
        let frameRate = Math.trunc(1000 * (frames / globalCtx.timeMs));
        ctx.font = "10px Arial";
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

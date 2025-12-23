/*
 * Kesir Pizza Şefi v3.0: Malzeme Şefi (Topping Master)
 * Realism + Educational Depth
 */

let video;
let handPose;
let hands = [];

// Assets
let imgPizzaBase;
let imgPepperoni;
let imgMushroom;
let imgOlive;

// Audio
let popOsc, popEnv;
let successOsc, successEnv;

// Interaction
let currentToppingImg;
let toppings = [];
let currentRecipe = [];

// Game State
let level = 1; // 1: Halves, 2: Quarters, 3: Eighths
let slices = 8; // Pizza is virtually sliced into 8 for math, but visually grouped
let targetNumerator = 0;
let targetDenominator = 0;
let currentFilled = 0;
let filledSlices = []; // Boolean array
let score = 0;
let gameMessage = "";
let gameState = "WAITING_START"; // Start waiting for HTML overlay

// Mirror State
let isMirrored = true; // User requested flip (Mirror default)

// Interaction
let hoverStartTime = 0;
let lastHoveredSlice = -1;
let hoverDuration = 600; // ms to place a topping
// Smoothing
let historyX = 0;
let historyY = 0;
let smoothFactor = 0.2;

function preload() {
    handPose = ml5.handPose({ flipped: true });

    // Load local realistic assets with Cache Busting
    let cb = "?v=" + new Date().getTime();
    imgPizzaBase = loadImage('assets/pizza_base.png' + cb);
    imgPepperoni = loadImage('assets/topping_pepperoni.png' + cb);
    imgMushroom = loadImage('assets/topping_mushroom.png' + cb);
    imgOlive = loadImage('assets/topping_olive.png' + cb);
}

function setup() {
    // Fullscreen responsive
    createCanvas(windowWidth, windowHeight);

    video = createCapture(VIDEO);
    video.size(640, 480);
    video.hide();

    handPose.detectStart(video, gotHands);

    textFont('Fredoka One');
    textAlign(CENTER, CENTER);

    // Prepare Toppings List
    toppings = [imgPepperoni, imgMushroom, imgOlive];

    // Init Sounds (Synth)
    userStartAudio(); // Expecting user interaction later

    // Pop Sound
    popOsc = new p5.Oscillator('sine');
    popEnv = new p5.Envelope();
    popEnv.setADSR(0.01, 0.05, 0.5, 0.1);
    popEnv.setRange(0.5, 0);

    // Success Sound
    successOsc = new p5.Oscillator('triangle');
    successEnv = new p5.Envelope();
    successEnv.setADSR(0.1, 0.2, 0.5, 0.5);
    successEnv.setRange(0.4, 0);

    // Init Game
    resetRound();

    // Expose start function for HTML overlay
    window.startGame = function () {
        let overlay = document.getElementById('instruction-overlay');
        if (overlay) overlay.style.display = 'none';

        userStartAudio(); // Initialize audio context on user gesture
        gameState = "PLAY";
        resetRound();
    };
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
    if (key === 'm' || key === 'M') {
        isMirrored = !isMirrored;
    }
}

function gotHands(results) {
    hands = results;
}

function resetRound() {
    // Difficulty and Slices based on level
    // Logic Update: Prioritize equivalent fractions after Level 1

    if (level === 1) {
        slices = 2; // Level 1: Standard Halves
        targetDenominator = 2;
    } else if (level === 2) {
        slices = 4; // Level 2: Quarters, but we will force 1/2 often
        targetDenominator = 4;
    } else if (level === 3) {
        slices = 6; // Level 3: Sixths (1/3, 1/2, 2/3)
        targetDenominator = 6;
    } else if (level === 4) {
        slices = 8; // Level 4: Eighths (1/4, 1/2, 3/4)
        targetDenominator = 8;
    } else if (level === 5) {
        slices = 12; // Level 5: Twelfths (Lots of options)
        targetDenominator = 12;
    } else {
        // Randomize for higher levels (Composite numbers preferred)
        let options = [4, 6, 8, 12];
        slices = random(options);
        targetDenominator = slices;
    }

    // Initialize filled state for new slice count
    filledSlices = new Array(slices).fill(null);
    currentFilled = 0;

    // RECIPE GENERATION
    currentRecipe = [];

    // Decide if Simple or Mixed Recipe
    // Mixed starts appearing from Level 5 (pushed back a bit to focus on equivalent fractions first)
    let isMixed = (level >= 5 && random() > 0.5);

    if (!isMixed) {
        // Simple: 1 Ingredient
        let t = random(toppings);
        let num;

        // Logic Update: Weighted Random Selection for Variety
        // We want a mix of:
        // 1. Equivalent Fractions (GCD > 1) -> High Weight
        // 2. Complex/Irreducible Fractions (3/4, 2/3) -> High Weight
        // 3. Unit Fractions (1/4) -> Normal Weight

        if (level >= 2) {
            let weightedList = [];

            for (let i = 1; i < slices; i++) {
                // Base chance (1 ticket)
                weightedList.push(i);

                // If Equivalent (GCD > 1), add 2 more tickets (High priority for simplifying)
                if (gcd(i, slices) > 1) {
                    weightedList.push(i);
                    weightedList.push(i);
                }

                // If Non-Unit (Numerator > 1), add 1 more ticket (Boost 3/4, 2/3 etc.)
                if (i > 1) {
                    weightedList.push(i);
                }
            }

            // Random pick from weighted bag
            if (weightedList.length > 0) {
                num = random(weightedList);
            } else {
                num = floor(random(1, slices));
            }

        } else {
            num = floor(random(1, slices)); // Pure random for Level 1
        }

        if (num === 0) num = 1;

        let tName = getToppingName(t);

        // Equivalent Fraction Logic
        let displayNum = num;
        let displayDen = targetDenominator;

        // Find simpler form
        let divisor = gcd(num, targetDenominator);

        // Force display of simplified fraction if divisor > 1 (Logic Update)
        if (divisor > 1) {
            displayNum = num / divisor;
            displayDen = targetDenominator / divisor;
            console.log(`Smart Question: Asking for ${displayNum}/${displayDen} on a ${slices}-slice pizza (Needs ${num} slices)`);
        }

        currentRecipe.push({
            img: t,
            count: num, // Actua slice count needed in background
            label: displayNum + "/" + displayDen + " " + tName
        });

        targetNumerator = num;
        currentToppingImg = t;

    } else {
        // Mixed: 2 Ingredients (Level 5+)
        let shuffled = [...toppings].sort(() => 0.5 - random());
        let t1 = shuffled[0];
        let t2 = shuffled[1];

        // Ingredient 1
        let max1 = slices - 1;
        let count1 = floor(random(1, max1 + 1));

        {
            let displayNum = count1;
            let displayDen = targetDenominator;
            let divisor = gcd(count1, targetDenominator);
            if (divisor > 1) { // Always simplify if possible
                displayNum = count1 / divisor;
                displayDen = targetDenominator / divisor;
            }

            currentRecipe.push({
                img: t1,
                count: count1,
                label: displayNum + "/" + displayDen + " " + getToppingName(t1)
            });
        }

        // Ingredient 2 (Optional)
        let remaining = slices - count1;
        if (remaining >= 1 && random() > 0.3) {
            let count2 = floor(random(1, remaining + 1));

            let displayNum = count2;
            let displayDen = targetDenominator;
            let divisor = gcd(count2, targetDenominator);
            if (divisor > 1) {
                displayNum = count2 / divisor;
                displayDen = targetDenominator / divisor;
            }

            currentRecipe.push({
                img: t2,
                count: count2,
                label: displayNum + "/" + displayDen + " " + getToppingName(t2)
            });
        }

        currentToppingImg = t1;
    }

    gameMessage = "";
}

function draw() {
    // AR Mode: No background color, just video
    // 1. Draw Background Video (Flipped or Normal)
    push();

    // IMPORTANT: Reset image mode to CORNER for background
    imageMode(CORNER);

    if (isMirrored) {
        translate(width, 0);
        scale(-1, 1);
    }

    // Draw full opacity video stretched to FILL screen
    if (video.loadedmetadata) {
        image(video, 0, 0, width, height);
    } else {
        image(video, 0, 0, width, height);
    }
    pop();

    // Darken slightly for UI contrast
    fill(44, 62, 80, 150);
    noStroke();
    rect(0, 0, width, height);

    // WAITING FOR START (HTML Overlay)
    if (gameState === "WAITING_START") {
        // Blur the video background slightly to focus attention on the HTML overlay
        filter(BLUR, 5);
        return;
    }

    // Determine Scale based on Screen
    // Pizza should be large but fit
    let minDim = min(width, height);
    let pizzaSize = minDim * 0.8;
    let cx = width / 2;
    let cy = height / 2 + 50; // Offset for text up top

    // 2. Info UI
    drawHeader(targetNumerator, targetDenominator);

    // 3. Draw Pizza Base
    imageMode(CENTER);
    image(imgPizzaBase, cx, cy, pizzaSize, pizzaSize);

    // 4. Draw Slots / Slices Grid
    drawSlicesGrid(cx, cy, pizzaSize);

    // 5. Draw Placed Toppings
    drawToppings(cx, cy, pizzaSize);

    // 6. Interaction
    // 6. Interaction
    handleInteraction(cx, cy, pizzaSize);

    // 7. Palette UI
    drawPalette();

    // 7. Feedback and Scoring Logic
    // Equivalent Fractions: How many 8ths equal the target fraction?
    // e.g. Target 1/2 -> (1/2) * 8 = 4 slices needed.
    let requiredSlices = (targetNumerator / targetDenominator) * slices;

    // 7. Feedback and Scoring Logic (Recipe Based)
    let isSuccess = true;
    let totalFilledRequired = 0;

    for (let item of currentRecipe) {
        totalFilledRequired += item.count;

        // Count current filled for this item type
        let currentCount = 0;
        for (let s of filledSlices) {
            if (s === item.img) currentCount++;
        }

        if (currentCount !== item.count) {
            isSuccess = false;
        }
    }

    // Check for "Too Many" overall
    if (currentFilled > totalFilledRequired) {
        fill(231, 76, 60);
        textSize(minDim * 0.08);
        text("ÇOK FAZLA!", cx, cy);

        if (frameCount % 120 === 0) resetRound();

    } else if (isSuccess) {
        // SUCCESS
        fill(46, 204, 113);
        textSize(minDim * 0.1);
        text("HARİKA!", cx, cy);

        if (frameCount % 60 === 0) {
            playSuccess();
            score += 10;
            if (score % 30 === 0) level++;
            resetRound();
        }
    }
}


function drawSlicesGrid(cx, cy, size) {
    // Visual guides for slices
    push();
    translate(cx, cy);
    noFill();
    stroke(255, 100);
    strokeWeight(2);

    let r = size / 2;

    for (let i = 0; i < slices; i++) {
        let angle = map(i, 0, slices, 0, TWO_PI) - HALF_PI;
        line(0, 0, cos(angle) * r, sin(angle) * r);
    }

    // Special bold lines (Actually, if slices==targetDenominator, all are bold?)
    stroke(255, 255, 0, 150);
    strokeWeight(4);

    // Just redraw all if simple fraction
    for (let i = 0; i < slices; i++) {
        let angle = map(i, 0, slices, 0, TWO_PI) - HALF_PI;
        line(0, 0, cos(angle) * r, sin(angle) * r);
    }
    pop();
}

function drawToppings(cx, cy, size) {
    let r_place = size * 0.3; // Distance from center

    for (let i = 0; i < slices; i++) {
        // Advanced: filledSlices[i] holds the image object or null
        if (filledSlices[i] !== null) {
            let img = filledSlices[i];

            let angle = map(i, 0, slices, 0, TWO_PI) - HALF_PI + (TWO_PI / (slices * 2)); // Center of slice
            let tx = cx + cos(angle) * r_place;
            let ty = cy + sin(angle) * r_place;

            // Pulse effect?
            let pulse = 1;
            image(img, tx, ty, (size / 6) * pulse, (size / 6) * pulse);
        }
    }
}

function handleInteraction(cx, cy, size) {
    if (hands.length > 0) {
        let index = hands[0].keypoints[8];

        // Normalized Mapping
        let nx;
        if (isMirrored) {
            nx = index.x / 640; // Direct X (Already flipped by ML5)
        } else {
            nx = 1 - (index.x / 640); // Flip back for Normal View
        }

        let ny = index.y / 480;

        let tx = nx * width;
        let ty = ny * height;

        // Smoothing (Lerp)
        if (historyX === 0 && historyY === 0) {
            historyX = tx;
            historyY = ty;
        }
        historyX = lerp(historyX, tx, smoothFactor);
        historyY = lerp(historyY, ty, smoothFactor);

        let hx = historyX;
        let hy = historyY;

        // Palette Interaction
        handlePaletteInteraction(hx, hy);

        // Check Gesture
        if (isPointing(hands[0])) {
            // Draw Hand Cursor (Green/Yellow)
            fill(255, 255, 0, 200);
            noStroke();
            circle(hx, hy, 20);
        } else {
            // Feedback: Please point with index finger
            fill(255, 0, 0, 100);
            noStroke();
            circle(hx, hy, 30);
            fill(255);
            textSize(16);
            text("Sadece İşaret Parmağı!", hx, hy - 40);
            return; // EXIT if not pointing
        }

        // Collision with Slices
        let d = dist(hx, hy, cx, cy);
        if (d < size / 2) {
            // Which slice logic...
            let angle = atan2(hy - cy, hx - cx);
            if (angle < 0) angle += TWO_PI;
            angle += HALF_PI;
            if (angle > TWO_PI) angle -= TWO_PI;

            let sliceIndex = floor(map(angle, 0, TWO_PI, 0, slices));
            sliceIndex = constrain(sliceIndex, 0, slices - 1);

            // Hover logic
            if (sliceIndex === lastHoveredSlice) {
                // Determine duration based on action
                // DIFFICULTY INCREASED: 2000ms to remove, 1200ms to add
                let duration = (filledSlices[sliceIndex] !== null) ? 2000 : 1200;

                // Holding...
                let elapsed = millis() - hoverStartTime;
                let progress = elapsed / duration;
                progress = constrain(progress, 0, 1);

                // Draw Progress Circle around finger
                noFill();
                stroke(255);
                strokeWeight(5);

                // Color indication: Green to add, Red to remove
                if (filledSlices[sliceIndex] === null) {
                    stroke(46, 204, 113); // Add Green
                } else {
                    stroke(231, 76, 60); // Remove Red
                }

                arc(hx, hy, 40, 40, 0, TWO_PI * progress);

                if (elapsed > duration) {
                    // TOGGLE Logic
                    if (filledSlices[sliceIndex] !== null) {
                        // Remove
                        filledSlices[sliceIndex] = null;
                        currentFilled--;
                        playPop();
                    } else {
                        // Add
                        filledSlices[sliceIndex] = currentToppingImg || imgPepperoni;
                        currentFilled++;
                        playPop();
                    }

                    // Reset hover to prevent machine-gun toggle
                    hoverStartTime = millis() + 500;
                }
            } else {
                lastHoveredSlice = sliceIndex;
                hoverStartTime = millis();
            }

            // Highlight Slice
            push();
            translate(cx, cy);
            fill(255, 255, 255, 50);
            noStroke();
            let startA = map(sliceIndex, 0, slices, 0, TWO_PI) - HALF_PI;
            arc(0, 0, size, size, startA, startA + TWO_PI / slices);
            pop();
        } else {
            lastHoveredSlice = -1;
        }
    }
}

function mousePressed() {
    // Removed mousePressed start logic as it's handled by HTML button now
    /*
    if (gameState === "START") {
        userStartAudio();
        gameState = "PLAY";
        resetRound();
    }
    */
}

function playPop() {
    if (!popEnv) return;
    popOsc.start();
    popOsc.freq(random(400, 600));
    popEnv.play(popOsc);
}

function playSuccess() {
    if (!successEnv) return;
    successOsc.start();
    successOsc.freq(800);
    successEnv.play(successOsc);
    // Sequence?
    setTimeout(() => { successOsc.freq(1200); successEnv.play(successOsc); }, 200);
}

function drawHeader(num, den) {
    fill(255);
    textSize(24);
    text("PUAN: " + score, width - 80, 40);

    // Task Text
    textSize(35);
    fill(255, 200, 50);

    // Construct text from currentRecipe
    let txt = "Sipariş: ";
    for (let i = 0; i < currentRecipe.length; i++) {
        let item = currentRecipe[i];
        txt += item.label; // e.g. "1/2 Mantar"
        if (i < currentRecipe.length - 1) txt += " + ";
    }

    text(txt, width / 2, 60);

    // Subtext
    textSize(18);
    fill(200);
    text("(Sadece İŞARET PARMAĞINIZI uzatarak kullanın)", width / 2, 100);
}

// Gesture Check: Is Index Extended and others curled?
function isPointing(hand) {
    // Top is 0, Wrist is High Y (in p5 coord) or Bottom of screen?
    // Wait, Keypoints: 0=Wrist. 
    // Fingertips: 8(Index), 12(Middle), 16(Ring), 20(Pinky)
    // PIPs: 6, 10, 14, 18

    // Distance from Wrist (0)
    let kp = hand.keypoints;
    let wrist = kp[0];

    let dIndex = dist(wrist.x, wrist.y, kp[8].x, kp[8].y);
    let dMiddle = dist(wrist.x, wrist.y, kp[12].x, kp[12].y);
    let dRing = dist(wrist.x, wrist.y, kp[16].x, kp[16].y);
    let dPinky = dist(wrist.x, wrist.y, kp[20].x, kp[20].y);

    // Simple Heuristic: Index should be significantly extended
    // And others should be relatively closer to wrist (curled)

    // Index extended check (relative to scale of hand)
    // Actually, just checking if Index is the "most extended" finger is often enough for simple pointing
    // But let's look for "Index D > Middle D * 1.2" or simply "Middle Curled"

    // Check if Middle, Ring, Pinky are curled
    // Curled = Tip is closer to wrist than PIP? Or just Tip.y vs PIP.y?
    // Orientation agnostic: Distance to Wrist.

    let isIndexExtended = dIndex > 50; // Basic threshold, dynamic?
    // Better: dIndex > dMiddle? 
    // If I point, Index is far, Middle is curled (close).

    if (dIndex > dMiddle * 1.1 && dIndex > dRing * 1.1 && dIndex > dPinky * 1.1) {
        return true;
    }
    return false;
}

// PALETTE UI
function drawPalette() {
    let px = width - 80;
    let py = 150;
    let gap = 100;

    push();
    textAlign(CENTER);
    textSize(20);
    fill(255);
    noStroke();
    text("MALZEMELER", px, py - 60);

    for (let i = 0; i < toppings.length; i++) {
        let tImg = toppings[i];
        let y = py + i * gap;

        // Highlight active
        if (currentToppingImg === tImg) {
            fill(255, 255, 255, 100);
            circle(px, y, 90);
        }

        imageMode(CENTER);
        image(tImg, px, y, 70, 70);
    }
    pop();
}

function handlePaletteInteraction(hx, hy) {
    let px = width - 80;
    let py = 150;
    let gap = 100;

    for (let i = 0; i < toppings.length; i++) {
        let y = py + i * gap;
        let d = dist(hx, hy, px, y);

        if (d < 45) {
            // Hovered over topping
            currentToppingImg = toppings[i];

            // Visual feedback
            noFill();
            stroke(255, 255, 0);
            strokeWeight(3);
            circle(px, y, 90);
        }
    }
}

function getToppingName(img) {
    if (img === imgPepperoni) return "Sucuk";
    if (img === imgMushroom) return "Mantar";
    if (img === imgOlive) return "Zeytin";
    return "Malzeme";
}

function gcd(a, b) {
    if (!b) {
        return a;
    }
    return gcd(b, a % b);
}

/*
 * Kesir Pizza Sefi v4.0: Seviye Secimli
 * Kolay / Orta / Zor modlari
 */

// ═══════════════════════════════════════
// p5.js / ml5.js Globals
// ═══════════════════════════════════════
let video;
let handPose;
let hands = [];

// Assets
let imgPizzaBase;
let imgPepperoni;
let imgMushroom;
let imgOlive;
let toppings = [];

// Audio
let popOsc, popEnv;
let successOsc, successEnv;

// Mirror State
let isMirrored = true;

// Smoothing
let smoothFactor = 0.2;

// ═══════════════════════════════════════
// Game State Object
// ═══════════════════════════════════════
let G = {
    phase: "DIFFICULTY_SELECT", // WAITING_START | DIFFICULTY_SELECT | PLAY | ROUND_SUCCESS | ROUND_FAIL
    difficulty: null,       // "kolay" | "orta" | "zor"
    questionType: "placement", // "placement" | "addition" | "decimal"

    level: 1,
    slices: 2,
    targetNumerator: 0,
    targetDenominator: 0,
    currentFilled: 0,
    filledSlices: [],
    score: 0,
    questionsAnswered: 0,

    currentRecipe: [],
    currentToppingImg: null,
    questionText: "",

    message: "",
    messageTimer: 0,

    hoverStartTime: 0,
    lastHoveredSlice: -1,
    historyX: 0,
    historyY: 0,

    // Difficulty select hover
    diffHoverIndex: -1,
    diffHoverStart: 0
};

// ═══════════════════════════════════════
// Preload & Setup
// ═══════════════════════════════════════
function preload() {
    handPose = ml5.handPose({ flipped: true });

    let cb = "?v=4.0";
    imgPizzaBase = loadImage('assets/pizza_base.png' + cb);
    imgPepperoni = loadImage('assets/topping_pepperoni.png' + cb);
    imgMushroom = loadImage('assets/topping_mushroom.png' + cb);
    imgOlive = loadImage('assets/topping_olive.png' + cb);
}

function setup() {
    createCanvas(windowWidth, windowHeight);

    video = createCapture(VIDEO);
    video.size(320, 240); // Optimized for Raspberry Pi
    video.hide();

    handPose.detectStart(video, gotHands);

    textFont('Nunito');
    textAlign(CENTER, CENTER);

    toppings = [imgPepperoni, imgMushroom, imgOlive];

    userStartAudio();

    popOsc = new p5.Oscillator('sine');
    popEnv = new p5.Envelope();
    popEnv.setADSR(0.01, 0.05, 0.5, 0.1);
    popEnv.setRange(0.5, 0);

    successOsc = new p5.Oscillator('triangle');
    successEnv = new p5.Envelope();
    successEnv.setADSR(0.1, 0.2, 0.5, 0.5);
    successEnv.setRange(0.4, 0);

    // No instruction overlay button needed anymore since the game auto starts
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function gotHands(results) {
    hands = results;
}

function keyPressed() {
    if (key === 'm' || key === 'M') {
        isMirrored = !isMirrored;
    }
}

// ═══════════════════════════════════════
// Layout
// ═══════════════════════════════════════
function getLayout() {
    let isPortrait = width < height;
    let minDim = min(width, height);

    let layout = {
        isPortrait: isPortrait,
        minDim: minDim,
        cx: width / 2,
        cy: height / 2,
        pizzaSize: minDim * 0.85,
        paletteHeight: 120,
        headerHeight: 100
    };

    if (isPortrait) {
        layout.pizzaSize = width * 0.85;
        layout.cy = (height - layout.paletteHeight - layout.headerHeight) / 2 + layout.headerHeight;
        layout.cx = width / 2;
    } else {
        layout.pizzaSize = height * 0.75;
        layout.cy = height / 2 + 30;
    }

    return layout;
}

// ═══════════════════════════════════════
// Main Draw Loop (Phase Dispatcher)
// ═══════════════════════════════════════
function draw() {
    drawVideoBackground();

    // Application auto-starts, bypassing WAITING_START

    if (G.phase === "DIFFICULTY_SELECT") {
        drawDifficultySelect(getLayout());
        return;
    }

    // PLAY, ROUND_SUCCESS, ROUND_FAIL
    drawGameplay(getLayout());
}

function drawVideoBackground() {
    push();
    imageMode(CORNER);
    if (isMirrored) {
        translate(width, 0);
        scale(-1, 1);
    }
    image(video, 0, 0, width, height);
    pop();

    fill(44, 62, 80, 150);
    noStroke();
    rect(0, 0, width, height);
}

// ═══════════════════════════════════════
// Difficulty Selection Screen
// ═══════════════════════════════════════
let diffButtons = [
    { label: "KOLAY", sub: "Temel Kesirler", color: [46, 204, 113], key: "kolay" },
    { label: "ORTA", sub: "Toplama & Ondalik", color: [243, 156, 18], key: "orta" },
    { label: "ZOR", sub: "Karisik & Ileri", color: [231, 76, 60], key: "zor" }
];

function drawDifficultySelect(layout) {
    let minDim = layout.minDim;

    // Title
    fill(241, 196, 15);
    noStroke();
    textSize(minDim * 0.08);
    textAlign(CENTER, CENTER);
    text("ZORLUK SEVİYESİ SEÇ", width / 2, height * 0.12);

    // Subtitle
    fill(200);
    textSize(minDim * 0.035);
    text("Parmağınla veya tıklayarak seç", width / 2, height * 0.19);

    let btnW = min(width * 0.7, 400);
    let btnH = minDim * 0.12;
    let gap = btnH * 0.4;
    let totalH = diffButtons.length * btnH + (diffButtons.length - 1) * gap;
    let startY = (height - totalH) / 2 + height * 0.05;

    // Get hand position for hover
    let hx = -1, hy = -1;
    if (hands.length > 0 && isPointing(hands[0])) {
        let idx = hands[0].keypoints[8];
        let nx = isMirrored ? (idx.x / video.width) : (1 - idx.x / video.width);
        let ny = idx.y / video.height;
        hx = lerp(G.historyX || nx * width, nx * width, smoothFactor);
        hy = lerp(G.historyY || ny * height, ny * height, smoothFactor);
        G.historyX = hx;
        G.historyY = hy;

        // Draw cursor
        fill(255, 255, 0, 200);
        noStroke();
        circle(hx, hy, 20);
    }

    for (let i = 0; i < diffButtons.length; i++) {
        let btn = diffButtons[i];
        let bx = width / 2 - btnW / 2;
        let by = startY + i * (btnH + gap);

        // Check hover
        let isHovered = (hx >= bx && hx <= bx + btnW && hy >= by && hy <= by + btnH);

        // Draw button
        let c = btn.color;
        if (isHovered) {
            fill(c[0], c[1], c[2], 255);
        } else {
            fill(c[0], c[1], c[2], 200);
        }
        stroke(255, 100);
        strokeWeight(3);
        rect(bx, by, btnW, btnH, 15);

        // Label
        fill(255);
        noStroke();
        textSize(minDim * 0.055);
        textAlign(CENTER, CENTER);
        text(btn.label, width / 2, by + btnH * 0.35);

        // Subtitle
        fill(255, 200);
        textSize(minDim * 0.03);
        text(btn.sub, width / 2, by + btnH * 0.7);

        // Hover dwell progress
        if (isHovered) {
            if (G.diffHoverIndex === i) {
                let elapsed = millis() - G.diffHoverStart;
                let progress = constrain(elapsed / 1000, 0, 1);

                // Progress arc
                noFill();
                stroke(255);
                strokeWeight(4);
                arc(bx + btnW - 30, by + btnH / 2, 30, 30, -HALF_PI, -HALF_PI + TWO_PI * progress);

                if (progress >= 1) {
                    selectDifficulty(btn.key);
                    return;
                }
            } else {
                G.diffHoverIndex = i;
                G.diffHoverStart = millis();
            }
        }
    }

    // Reset hover if not on any button
    if (hx < 0 || hy < 0) {
        G.diffHoverIndex = -1;
    }
}

function selectDifficulty(key) {
    G.difficulty = key;
    G.phase = "PLAY";
    G.score = 0;
    G.level = 1;
    G.questionsAnswered = 0;
    G.diffHoverIndex = -1;
    resetRound();
}

function mouseClicked() {
    if (G.phase === "DIFFICULTY_SELECT") {
        let layout = getLayout();
        let minDim = layout.minDim;
        let btnW = min(width * 0.7, 400);
        let btnH = minDim * 0.12;
        let gap = btnH * 0.4;
        let totalH = diffButtons.length * btnH + (diffButtons.length - 1) * gap;
        let startY = (height - totalH) / 2 + height * 0.05;

        for (let i = 0; i < diffButtons.length; i++) {
            let bx = width / 2 - btnW / 2;
            let by = startY + i * (btnH + gap);

            if (mouseX >= bx && mouseX <= bx + btnW && mouseY >= by && mouseY <= by + btnH) {
                selectDifficulty(diffButtons[i].key);
                return;
            }
        }
    }
}

// ═══════════════════════════════════════
// Gameplay
// ═══════════════════════════════════════
function drawGameplay(layout) {
    let minDim = layout.minDim;
    let pizzaSize = layout.pizzaSize;
    let cx = layout.cx;
    let cy = layout.cy;

    drawHeader(layout);

    imageMode(CENTER);
    image(imgPizzaBase, cx, cy, pizzaSize, pizzaSize);

    drawSlicesGrid(cx, cy, pizzaSize);
    drawToppings(cx, cy, pizzaSize);
    handleInteraction(cx, cy, pizzaSize, layout);
    drawPalette(layout);

    // Phase messages
    if (G.phase === "ROUND_SUCCESS") {
        fill(46, 204, 113);
        textSize(minDim * 0.1);
        textAlign(CENTER, CENTER);
        text("HARİKA!", cx, cy);

        if (millis() > G.messageTimer) {
            G.phase = "PLAY";
            resetRound();
        }
    } else if (G.phase === "ROUND_FAIL") {
        fill(231, 76, 60);
        textSize(minDim * 0.08);
        textAlign(CENTER, CENTER);
        text("ÇOK FAZLA!", cx, cy);

        if (millis() > G.messageTimer) {
            G.phase = "PLAY";
            resetRound();
        }
    }
}

// ═══════════════════════════════════════
// Question Generation
// ═══════════════════════════════════════
function resetRound() {
    G.filledSlices = [];
    G.currentFilled = 0;
    G.currentRecipe = [];
    G.questionText = "";
    G.questionType = "placement";
    G.hoverStartTime = 0;
    G.lastHoveredSlice = -1;

    if (G.difficulty === "kolay") {
        generateKolayQuestion();
    } else if (G.difficulty === "orta") {
        generateOrtaQuestion();
    } else if (G.difficulty === "zor") {
        generateZorQuestion();
    } else {
        generateKolayQuestion();
    }

    G.filledSlices = new Array(G.slices).fill(null);
}

// --- KOLAY (Easy) ---
function generateKolayQuestion() {
    // Level progression
    if (G.level === 1) {
        G.slices = 2;
    } else if (G.level === 2) {
        G.slices = 4;
    } else if (G.level === 3) {
        G.slices = 6;
    } else if (G.level === 4) {
        G.slices = 8;
    } else if (G.level === 5) {
        G.slices = 12;
    } else {
        G.slices = randomFromArray([4, 6, 8, 12]);
    }
    G.targetDenominator = G.slices;

    G.currentRecipe = [];

    let isMixed = (G.questionsAnswered >= 4 && random() > 0.5);

    if (!isMixed) {
        let t = randomFromArray(toppings);
        let num = pickWeightedNumerator(G.slices, G.level);

        let displayNum = num;
        let displayDen = G.targetDenominator;
        let divisor = gcd(num, G.targetDenominator);
        if (divisor > 1) {
            displayNum = num / divisor;
            displayDen = G.targetDenominator / divisor;
        }

        G.currentRecipe.push({
            img: t,
            count: num,
            label: displayNum + "/" + displayDen + " " + getToppingName(t)
        });

        G.targetNumerator = num;
        G.currentToppingImg = t;
    } else {
        generateMixedRecipe();
    }
}

// --- ORTA (Medium) ---
function generateOrtaQuestion() {
    if (random() > 0.5) {
        generateAdditionQuestion();
    } else {
        generateDecimalQuestion();
    }
}

function generateAdditionQuestion() {
    G.questionType = "addition";

    // Slice counts for addition
    let sliceOptions;
    if (G.level <= 2) {
        sliceOptions = [4, 6];
    } else {
        sliceOptions = [4, 6, 8];
    }
    G.slices = randomFromArray(sliceOptions);
    G.targetDenominator = G.slices;

    // Generate two fractions that sum to <= slices
    let n1 = floor(random(1, G.slices - 1));
    let maxN2 = G.slices - n1;
    let n2 = floor(random(1, maxN2 + 1));
    let total = n1 + n2;

    // Simplify each part for display
    let d1 = gcd(n1, G.slices);
    let d2 = gcd(n2, G.slices);
    let dispN1 = n1 / d1;
    let dispD1 = G.slices / d1;
    let dispN2 = n2 / d2;
    let dispD2 = G.slices / d2;

    G.questionText = dispN1 + "/" + dispD1 + " + " + dispN2 + "/" + dispD2 + " = ?";

    let t = randomFromArray(toppings);
    G.currentToppingImg = t;
    G.targetNumerator = total;

    G.currentRecipe = [{
        img: t,
        count: total,
        label: G.questionText
    }];
}

function generateDecimalQuestion() {
    G.questionType = "decimal";

    // Only use denominators that produce clean decimals
    let sliceOptions;
    if (G.level <= 2) {
        sliceOptions = [2, 4];
    } else {
        sliceOptions = [4, 8];
    }
    G.slices = randomFromArray(sliceOptions);
    G.targetDenominator = G.slices;

    let num = floor(random(1, G.slices));
    if (num === 0) num = 1;

    let decimal = num / G.slices;

    // Format cleanly
    let decimalStr;
    if (G.slices <= 4) {
        decimalStr = cleanDecimal(decimal, 2);
    } else {
        decimalStr = cleanDecimal(decimal, 3);
    }

    G.questionText = decimalStr + " kadar pizza doldur";
    G.targetNumerator = num;

    let t = randomFromArray(toppings);
    G.currentToppingImg = t;

    G.currentRecipe = [{
        img: t,
        count: num,
        label: G.questionText
    }];
}

// --- ZOR (Hard) ---
function generateZorQuestion() {
    let questionRoll = random();

    if (questionRoll < 0.35) {
        // Complex mixed recipe
        G.slices = randomFromArray([8, 12]);
        G.targetDenominator = G.slices;
        G.questionType = "placement";
        generateMixedRecipe();
    } else if (questionRoll < 0.65) {
        // Hard addition
        generateHardAdditionQuestion();
    } else {
        // Equivalent fraction challenge
        generateEquivalentQuestion();
    }
}

function generateHardAdditionQuestion() {
    G.questionType = "addition";
    G.slices = randomFromArray([8, 12]);
    G.targetDenominator = G.slices;

    let n1 = floor(random(1, floor(G.slices * 0.6)));
    let maxN2 = G.slices - n1;
    let n2 = floor(random(1, min(maxN2 + 1, floor(G.slices * 0.6))));
    let total = n1 + n2;

    let d1 = gcd(n1, G.slices);
    let d2 = gcd(n2, G.slices);

    G.questionText = (n1 / d1) + "/" + (G.slices / d1) + " + " + (n2 / d2) + "/" + (G.slices / d2) + " = ?";
    G.targetNumerator = total;

    let t = randomFromArray(toppings);
    G.currentToppingImg = t;

    G.currentRecipe = [{
        img: t,
        count: total,
        label: G.questionText
    }];
}

function generateEquivalentQuestion() {
    G.questionType = "placement";
    G.slices = randomFromArray([8, 12]);
    G.targetDenominator = G.slices;

    // Pick a numerator that simplifies
    let candidates = [];
    for (let i = 1; i < G.slices; i++) {
        if (gcd(i, G.slices) > 1) {
            candidates.push(i);
        }
    }

    let num = candidates.length > 0 ? randomFromArray(candidates) : 1;
    let divisor = gcd(num, G.slices);
    let displayNum = num / divisor;
    let displayDen = G.slices / divisor;

    let t = randomFromArray(toppings);
    G.currentToppingImg = t;
    G.targetNumerator = num;

    G.currentRecipe = [{
        img: t,
        count: num,
        label: displayNum + "/" + displayDen + " " + getToppingName(t)
    }];
}

// --- Mixed Recipe Helper ---
function generateMixedRecipe() {
    let shuffled = shuffleArray(toppings);
    let t1 = shuffled[0];
    let t2 = shuffled[1];

    let count1 = floor(random(1, G.slices - 1));

    {
        let displayNum = count1;
        let displayDen = G.targetDenominator;
        let divisor = gcd(count1, G.targetDenominator);
        if (divisor > 1) {
            displayNum = count1 / divisor;
            displayDen = G.targetDenominator / divisor;
        }
        G.currentRecipe.push({
            img: t1,
            count: count1,
            label: displayNum + "/" + displayDen + " " + getToppingName(t1)
        });
    }

    let remaining = G.slices - count1;
    if (remaining >= 1 && random() > 0.3) {
        let count2 = floor(random(1, remaining + 1));

        let displayNum = count2;
        let displayDen = G.targetDenominator;
        let divisor = gcd(count2, G.targetDenominator);
        if (divisor > 1) {
            displayNum = count2 / divisor;
            displayDen = G.targetDenominator / divisor;
        }
        G.currentRecipe.push({
            img: t2,
            count: count2,
            label: displayNum + "/" + displayDen + " " + getToppingName(t2)
        });
    }

    G.targetNumerator = count1;
    G.currentToppingImg = t1;
}

// --- Weighted Numerator Picker ---
function pickWeightedNumerator(sliceCount, level) {
    if (level < 2) {
        let n = floor(random(1, sliceCount));
        return n === 0 ? 1 : n;
    }

    let weightedList = [];
    for (let i = 1; i < sliceCount; i++) {
        weightedList.push(i);
        if (gcd(i, sliceCount) > 1) {
            weightedList.push(i);
            weightedList.push(i);
        }
        if (i > 1) {
            weightedList.push(i);
        }
    }

    if (weightedList.length > 0) {
        return randomFromArray(weightedList);
    }
    let n = floor(random(1, sliceCount));
    return n === 0 ? 1 : n;
}

// ═══════════════════════════════════════
// Answer Checking
// ═══════════════════════════════════════
function checkAnswer() {
    if (G.phase !== "PLAY") return;

    let totalRequired = 0;
    let allCorrect = true;

    for (let item of G.currentRecipe) {
        totalRequired += item.count;
        let count = 0;
        for (let s of G.filledSlices) {
            if (s === item.img) count++;
        }
        if (count !== item.count) allCorrect = false;
    }

    if (G.currentFilled > totalRequired) {
        G.phase = "ROUND_FAIL";
        G.messageTimer = millis() + 2500;
    } else if (allCorrect && G.currentFilled === totalRequired) {
        G.phase = "ROUND_SUCCESS";
        G.messageTimer = millis() + 1500;
        playSuccess();

        let pts = 10;
        if (G.difficulty === "orta") pts = 15;
        if (G.difficulty === "zor") pts = 20;
        G.score += pts;
        G.questionsAnswered++;
        handleLevelUp();
    }
}

function handleLevelUp() {
    let threshold = (G.difficulty === "zor") ? 4 : 3;
    if (G.questionsAnswered % threshold === 0 && G.questionsAnswered > 0) {
        G.level++;
    }
}

// ═══════════════════════════════════════
// Drawing Functions
// ═══════════════════════════════════════
function drawHeader(layout) {
    let minDim = layout.minDim;

    // Difficulty badge
    let diffLabel = "";
    if (G.difficulty === "kolay") diffLabel = "KOLAY";
    else if (G.difficulty === "orta") diffLabel = "ORTA";
    else if (G.difficulty === "zor") diffLabel = "ZOR";

    fill(255);
    textSize(minDim * 0.04);

    if (layout.isPortrait) {
        push();
        textAlign(LEFT, CENTER);
        text(diffLabel + " | PUAN: " + G.score, 20, 35);
        pop();
    } else {
        push();
        textAlign(RIGHT, CENTER);
        text(diffLabel + " | PUAN: " + G.score, width - 20, 35);
        pop();
    }

    // Question text
    textSize(minDim * 0.06);
    fill(255, 200, 50);
    textAlign(CENTER, CENTER);

    if (G.questionType === "addition" || G.questionType === "decimal") {
        text(G.questionText, width / 2, 65);
    } else {
        let txt = "Sipariş: ";
        for (let i = 0; i < G.currentRecipe.length; i++) {
            txt += G.currentRecipe[i].label;
            if (i < G.currentRecipe.length - 1) txt += " + ";
        }
        text(txt, width / 2, 65);
    }

    // Hint text
    textSize(minDim * 0.03);
    fill(200);
    text("İşaret parmağınız ile Malzeme seçip Pizza'nın üzerine yerleştirin", width / 2, layout.isPortrait ? 90 : 100);
}

function drawSlicesGrid(cx, cy, size) {
    push();
    translate(cx, cy);
    noFill();
    let r = size / 2;

    for (let i = 0; i < G.slices; i++) {
        let angle = map(i, 0, G.slices, 0, TWO_PI) - HALF_PI;
        stroke(255, 255, 0, 150);
        strokeWeight(3);
        line(0, 0, cos(angle) * r, sin(angle) * r);
    }
    pop();
}

function drawToppings(cx, cy, size) {
    let r_place = size * 0.3;
    let tSize = size / 5.5;

    for (let i = 0; i < G.slices; i++) {
        if (G.filledSlices[i] !== null) {
            let img = G.filledSlices[i];
            let angle = map(i, 0, G.slices, 0, TWO_PI) - HALF_PI + (TWO_PI / (G.slices * 2));
            let tx = cx + cos(angle) * r_place;
            let ty = cy + sin(angle) * r_place;

            let pulse = 1 + 0.03 * sin(frameCount * 0.1 + i);
            let finalSize = tSize * pulse;

            push();
            if (img === imgPepperoni) {
                drawingContext.shadowBlur = 20;
                drawingContext.shadowColor = 'rgba(255, 255, 200, 0.8)';
            } else {
                drawingContext.shadowBlur = 15;
                drawingContext.shadowColor = 'rgba(255, 255, 255, 0.6)';
            }
            imageMode(CENTER);
            image(img, tx, ty, finalSize, finalSize);
            pop();
        }
    }
}

// ═══════════════════════════════════════
// Interaction
// ═══════════════════════════════════════
function handleInteraction(cx, cy, size, layout) {
    if (G.phase !== "PLAY") return;
    if (hands.length === 0) return;

    let index = hands[0].keypoints[8];
    let nx = isMirrored ? (index.x / video.width) : (1 - index.x / video.width);
    let ny = index.y / video.height;

    let tx = nx * width;
    let ty = ny * height;

    // Smoothing
    if (G.historyX === 0 && G.historyY === 0) {
        G.historyX = tx;
        G.historyY = ty;
    }
    G.historyX = lerp(G.historyX, tx, smoothFactor);
    G.historyY = lerp(G.historyY, ty, smoothFactor);

    let hx = G.historyX;
    let hy = G.historyY;

    // Palette interaction
    handlePaletteInteraction(hx, hy, layout);

    // Gesture check
    if (isPointing(hands[0])) {
        fill(255, 255, 0, 200);
        noStroke();
        circle(hx, hy, 20);
    } else {
        fill(255, 0, 0, 100);
        noStroke();
        circle(hx, hy, 30);
        fill(255);
        textSize(layout.minDim * 0.04);
        textAlign(CENTER, CENTER);
        text("Sadece İşaret Parmağı!", hx, hy - 40);
        return;
    }

    // Slice collision
    let d = dist(hx, hy, cx, cy);
    if (d < size / 2) {
        let angle = atan2(hy - cy, hx - cx);
        if (angle < 0) angle += TWO_PI;
        angle += HALF_PI;
        if (angle > TWO_PI) angle -= TWO_PI;

        let sliceIndex = floor(map(angle, 0, TWO_PI, 0, G.slices));
        sliceIndex = constrain(sliceIndex, 0, G.slices - 1);

        if (sliceIndex === G.lastHoveredSlice) {
            let duration = (G.filledSlices[sliceIndex] !== null) ? 2000 : 1200;
            let elapsed = millis() - G.hoverStartTime;
            let progress = constrain(elapsed / duration, 0, 1);

            noFill();
            strokeWeight(5);
            if (G.filledSlices[sliceIndex] === null) {
                stroke(46, 204, 113);
            } else {
                stroke(231, 76, 60);
            }
            arc(hx, hy, 40, 40, 0, TWO_PI * progress);

            if (elapsed > duration) {
                if (G.filledSlices[sliceIndex] !== null) {
                    G.filledSlices[sliceIndex] = null;
                    G.currentFilled--;
                    playPop();
                } else {
                    G.filledSlices[sliceIndex] = G.currentToppingImg || imgPepperoni;
                    G.currentFilled++;
                    playPop();
                }

                G.hoverStartTime = millis() + 500;

                // Check answer after each toggle
                checkAnswer();
            }
        } else {
            G.lastHoveredSlice = sliceIndex;
            G.hoverStartTime = millis();
        }

        // Highlight slice
        push();
        translate(cx, cy);
        fill(255, 255, 255, 50);
        noStroke();
        let startA = map(sliceIndex, 0, G.slices, 0, TWO_PI) - HALF_PI;
        arc(0, 0, size, size, startA, startA + TWO_PI / G.slices);
        pop();
    } else {
        G.lastHoveredSlice = -1;
    }
}

// ═══════════════════════════════════════
// Palette
// ═══════════════════════════════════════
function drawPalette(layout) {
    push();
    textAlign(CENTER, CENTER);
    noStroke();

    let iconSize = layout.minDim * 0.12;
    let gap = iconSize * 1.4;

    if (layout.isPortrait) {
        let py = height - iconSize * 0.8;
        let totalW = (toppings.length - 1) * gap;
        let startX = width / 2 - totalW / 2;

        fill(255, 200);
        textSize(layout.minDim * 0.04);
        text("MALZEMELER", width / 2, py - iconSize * 0.8);

        for (let i = 0; i < toppings.length; i++) {
            let tImg = toppings[i];
            let x = startX + i * gap;

            if (G.currentToppingImg === tImg) {
                fill(255, 255, 255, 100);
                circle(x, py, iconSize * 1.3);
            }

            imageMode(CENTER);
            image(tImg, x, py, iconSize, iconSize);
        }
    } else {
        let px = width - 80;
        let py = 150;
        let vGap = 100;

        fill(255);
        textSize(20);
        text("MALZEMELER", px, py - 60);

        for (let i = 0; i < toppings.length; i++) {
            let tImg = toppings[i];
            let y = py + i * vGap;

            if (G.currentToppingImg === tImg) {
                fill(255, 255, 255, 100);
                circle(px, y, 90);
            }

            imageMode(CENTER);
            image(tImg, px, y, 70, 70);
        }
    }
    pop();
}

function handlePaletteInteraction(hx, hy, layout) {
    let iconSize = layout.minDim * 0.12;
    let gap = iconSize * 1.4;

    if (layout.isPortrait) {
        let py = height - iconSize * 0.8;
        let totalW = (toppings.length - 1) * gap;
        let startX = width / 2 - totalW / 2;

        for (let i = 0; i < toppings.length; i++) {
            let x = startX + i * gap;
            if (dist(hx, hy, x, py) < iconSize * 0.8) {
                G.currentToppingImg = toppings[i];
                noFill();
                stroke(255, 255, 0);
                strokeWeight(3);
                circle(x, py, iconSize * 1.3);
            }
        }
    } else {
        let px = width - 80;
        let py = 150;
        let vGap = 100;

        for (let i = 0; i < toppings.length; i++) {
            let y = py + i * vGap;
            if (dist(hx, hy, px, y) < 45) {
                G.currentToppingImg = toppings[i];
                noFill();
                stroke(255, 255, 0);
                strokeWeight(3);
                circle(px, y, 90);
            }
        }
    }
}

// ═══════════════════════════════════════
// Gesture Detection
// ═══════════════════════════════════════
function isPointing(hand) {
    let kp = hand.keypoints;
    let wrist = kp[0];

    let dIndex = dist(wrist.x, wrist.y, kp[8].x, kp[8].y);
    let dMiddle = dist(wrist.x, wrist.y, kp[12].x, kp[12].y);
    let dRing = dist(wrist.x, wrist.y, kp[16].x, kp[16].y);
    let dPinky = dist(wrist.x, wrist.y, kp[20].x, kp[20].y);

    return (dIndex > dMiddle * 1.1 && dIndex > dRing * 1.1 && dIndex > dPinky * 1.1);
}

// ═══════════════════════════════════════
// Audio
// ═══════════════════════════════════════
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
    setTimeout(() => { successOsc.freq(1200); successEnv.play(successOsc); }, 200);
}

// ═══════════════════════════════════════
// Utilities
// ═══════════════════════════════════════
function getToppingName(img) {
    if (img === imgPepperoni) return "Sucuk";
    if (img === imgMushroom) return "Mantar";
    if (img === imgOlive) return "Zeytin";
    return "Malzeme";
}

function gcd(a, b) {
    if (!b) return a;
    return gcd(b, a % b);
}

function shuffleArray(arr) {
    let a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        let j = floor(random(i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function randomFromArray(arr) {
    return arr[floor(random(arr.length))];
}

function cleanDecimal(val, maxDigits) {
    let str = val.toFixed(maxDigits);
    // Remove trailing zeros after decimal point
    str = str.replace(/(\.\d*?)0+$/, '$1');
    // Remove trailing dot
    str = str.replace(/\.$/, '');
    return str;
}

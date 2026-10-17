
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let audioContext = null;

function playSound(frequency = 650, duration = 0.07) {
    if (!audioContext) {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}


const TILE = 28;


const originalMaze = [
    "####################",
    "#........##........#",
    "#.####...##...####.#",
    "#..................#",
    "#.####.######.####.#",
    "#..................#",
    "####.###.##.###.####",
    "#....#......#....#.#",
    "#.##............##.#",
    "#..................#",
    "#.####......####...#",
    "#..................#",
    "#.##............##.#",
    "#....#......#....#.#",
    "####.###.##.###.####",
    "#..................#",
    "#.####.######.####.#",
    "#..................#",
    "#........##........#",
    "####################"
];


let maze;
let score = 0;
let lives = 3;
let gameOver = false;
let won = false;
let paused = false;
let powerTimer = 0;

const pacman = {
    x: 1,
    y: 1,
    dx: 0,
    dy: 0,
    nextDx: 0,
    nextDy: 0
};

const ghostStarts = [
    { x: 9, y: 9, color: "#ff3b55" },
    { x: 15, y: 9, color: "#00e5ff" }
];

let ghosts = [];

function resetGhosts() {
    ghosts = ghostStarts.map(g => ({
        x: g.x,
        y: g.y,
        color: g.color
    }));
}

function restartGame() {
    maze = originalMaze.map(row => row.split(""));

    // Add four power pellets at accessible corners.
    maze[3][1] = "o";
    maze[3][18] = "o";
    maze[17][1] = "o";
    maze[17][18] = "o";

    score = 0;
    lives = 3;
    gameOver = false;
    won = false;
    powerTimer = 0;

    pacman.x = 1;
    pacman.y = 1;
    pacman.dx = 0;
    pacman.dy = 0;
    pacman.nextDx = 0;
    pacman.nextDy = 0;

    resetGhosts();

    // Collect the pellet under the starting position.
    collectPellet();
    updateStats();
    draw();
}

function updateStats() {
    document.getElementById("score").textContent = score;
    document.getElementById("lives").textContent = lives;
}

function isWall(x, y) {
    return (
        y < 0 ||
        y >= maze.length ||
        x < 0 ||
        x >= maze[y].length ||
        maze[y][x] === "#"
    );
}

function collectPellet() {
    const cell = maze[pacman.y][pacman.x];

    if (cell === ".") {
        score += 10;
        maze[pacman.y][pacman.x] = " ";
        playSound();
    }

    if (cell === "o") {
        score += 50;
        maze[pacman.y][pacman.x] = " ";

        // Frighten ghosts for 7 seconds.
        powerTimer = 7;
        playSound(300, 0.22);
        setTimeout(() => playSound(600, 0.18), 100);
    }

    updateStats();
    checkWin();
}


function checkWin() {
    const pelletsRemain = maze.some(row =>
        row.some(cell => cell === "." || cell === "o")
    );

    if (!pelletsRemain && !won) {
        won = true;

        playSound(700, 0.15);
        setTimeout(() => playSound(900, 0.15), 150);
        setTimeout(() => playSound(1100, 0.3), 300);
    }
}


function movePacman() {
    if (gameOver || won) return;

    // Turn when the requested direction is clear.
    if (
        pacman.nextDx !== 0 ||
        pacman.nextDy !== 0
    ) {
        if (!isWall(
            pacman.x + pacman.nextDx,
            pacman.y + pacman.nextDy
        )) {
            pacman.dx = pacman.nextDx;
            pacman.dy = pacman.nextDy;
        }
    }

    if (!isWall(
        pacman.x + pacman.dx,
        pacman.y + pacman.dy
    )) {
        pacman.x += pacman.dx;
        pacman.y += pacman.dy;

        collectPellet();
    }

    checkCollisions();
}

function moveGhosts() {
    if (gameOver || won) return;

    for (const ghost of ghosts) {
        const options = [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0]
        ].filter(([dx, dy]) =>
            !isWall(ghost.x + dx, ghost.y + dy)
        );

        if (options.length === 0) continue;

        // Chase Pac-Man normally; run away during power mode.
        options.sort((a, b) => {
            const distanceA =
                Math.abs(ghost.x + a[0] - pacman.x) +
                Math.abs(ghost.y + a[1] - pacman.y);

            const distanceB =
                Math.abs(ghost.x + b[0] - pacman.x) +
                Math.abs(ghost.y + b[1] - pacman.y);

            return powerTimer > 0
                ? distanceB - distanceA
                : distanceA - distanceB;
        });

        let chosen = options[0];

        if (options.length > 1 && Math.random() < 0.3) {
            chosen = options[
                Math.floor(Math.random() * options.length)
            ];
        }

        ghost.x += chosen[0];
        ghost.y += chosen[1];
    }

    checkCollisions();
}

function checkCollisions() {
    if (gameOver || won) return;

    for (const ghost of ghosts) {
        if (
            ghost.x === pacman.x &&
            ghost.y === pacman.y
        ) {
            if (powerTimer > 0) {
                // Eat a frightened ghost.
                score += 200;

                playSound(850, 0.12);
                setTimeout(() => playSound(1100, 0.15), 80);

                ghost.x = 9;
                ghost.y = 9;
            } else {
                // Lose a life.
                lives--;
                playSound(180, 0.45);
                updateStats();

                if (lives <= 0) {
                    gameOver = true;
                } else {
                    pacman.x = 1;
                    pacman.y = 1;
                    pacman.dx = 0;
                    pacman.dy = 0;
                    pacman.nextDx = 0;
                    pacman.nextDy = 0;

                    resetGhosts();
                    collectPellet();
                }
            }
        }
    }

    updateStats();
}

function drawMaze() {
    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
            const px = x * TILE;
            const py = y * TILE;

            if (maze[y][x] === "#") {
                ctx.fillStyle = "#1010bb";
                ctx.fillRect(px, py, TILE, TILE);

                ctx.strokeStyle = "#5555ff";
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    px + 2,
                    py + 2,
                    TILE - 4,
                    TILE - 4
                );
            } else if (maze[y][x] === ".") {
                ctx.fillStyle = "#ffe6b3";
                ctx.beginPath();
                ctx.arc(
                    px + TILE / 2,
                    py + TILE / 2,
                    3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            } else if (maze[y][x] === "o") {
                // Large flashing power pellet.
                const radius =
                    6 + Math.sin(performance.now() / 120) * 1.5;

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(
                    px + TILE / 2,
                    py + TILE / 2,
                    radius,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    }
}


function drawPacman() {
    const px = pacman.x * TILE + TILE / 2;
    const py = pacman.y * TILE + TILE / 2;

    let angle = 0;

    if (pacman.dx === -1) angle = Math.PI;
    if (pacman.dy === -1) angle = -Math.PI / 2;
    if (pacman.dy === 1) angle = Math.PI / 2;

    // Animate Pac-Man's mouth.
    const mouth =
        0.05 + Math.abs(Math.sin(performance.now() / 75)) * 0.38;

    ctx.fillStyle = "#ffdf00";
    ctx.beginPath();
    ctx.moveTo(px, py);

    ctx.arc(
        px,
        py,
        11,
        angle + mouth,
        angle + Math.PI * 2 - mouth
    );

    ctx.closePath();
    ctx.fill();
}

function drawGhosts() {
    for (const ghost of ghosts) {
        const px = ghost.x * TILE + TILE / 2;
        const py = ghost.y * TILE + TILE / 2;

        ctx.fillStyle = powerTimer > 0
            ? "#334dff"
            : ghost.color;

        ctx.beginPath();
        ctx.arc(px, py, 11, Math.PI, 0);
        ctx.lineTo(px + 11, py + 10);
        ctx.lineTo(px + 5, py + 7);
        ctx.lineTo(px, py + 10);
        ctx.lineTo(px - 5, py + 7);
        ctx.lineTo(px - 11, py + 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px - 4, py - 2, 3, 0, Math.PI * 2);
        ctx.arc(px + 4, py - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111111";
        ctx.fillRect(px - 5, py - 2, 2, 3);
        ctx.fillRect(px + 3, py - 2, 2, 3);
    }
}

function drawOverlay(title, color, subtitle) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(40, 220, 480, 120);

    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = "bold 34px Arial";
    ctx.fillText(title, 280, 265);

    ctx.fillStyle = "#ffffff";
    ctx.font = "17px Arial";
    ctx.fillText(subtitle, 280, 300);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawMaze();
    drawPacman();
    drawGhosts();

    if (powerTimer > 0 && !gameOver && !won) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
            "POWER: " + Math.ceil(powerTimer),
            280,
            18
        );
    }

    if (gameOver) {
        drawOverlay(
            "GAME OVER",
            "#ff3b55",
            "Press R to try again"
        );
    }

    if (won) {
        drawOverlay(
            "YOU WIN!",
            "#ffdf00",
            "Press R to play again"
        );
    }
}

document.addEventListener("keydown", function(event) {
    const key = event.key.toLowerCase();

    if (key === "p" && !gameOver && !won) {
        paused = !paused;

        if (paused) {
            menuTitle.textContent = "PAUSED";
            menuMessage.textContent = "Take a break!";
            startButton.textContent = "RESUME";
            menuOverlay.style.display = "flex";
        } else {
            menuOverlay.style.display = "none";
        }

        return;
    }

    if (key === "r") {
        restartGame();
        return;
    }

    const directions = {
        arrowup: [0, -1],
        w: [0, -1],
        arrowdown: [0, 1],
        s: [0, 1],
        arrowleft: [-1, 0],
        a: [-1, 0],
        arrowright: [1, 0],
        d: [1, 0]
    };

    if (directions[key]) {
        event.preventDefault();

        if (!gameOver && !won) {
            pacman.nextDx = directions[key][0];
            pacman.nextDy = directions[key][1];
        }
    }
});

let previousTime = 0;
let playerAccumulator = 0;
let ghostAccumulator = 0;

const PLAYER_DELAY = 130;
const GHOST_DELAY = 400;

function gameLoop(time) {
    const deltaTime = previousTime === 0
        ? 0
        : Math.min((time - previousTime) / 1000, 0.1);

    previousTime = time;

    if (!gameOver && !won && !paused) {
        if (powerTimer > 0) {
            powerTimer = Math.max(0, powerTimer - deltaTime);
        }

        playerAccumulator += deltaTime * 1000;
        ghostAccumulator += deltaTime * 1000;

        if (playerAccumulator >= PLAYER_DELAY) {
            movePacman();
            playerAccumulator = 0;
        }

        if (ghostAccumulator >= GHOST_DELAY) {
            moveGhosts();
            ghostAccumulator = 0;
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

const menuOverlay = document.getElementById("menuOverlay");
const menuTitle = menuOverlay.querySelector("h2");
const menuMessage = menuOverlay.querySelector("p");
const startButton = document.getElementById("startButton");

function startGame() {
    if (!paused) {
        restartGame();
    }

    paused = false;
    menuOverlay.style.display = "none";
}

startButton.addEventListener("click", startGame);

restartGame();
requestAnimationFrame(gameLoop);


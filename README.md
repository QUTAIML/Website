# QUT AI & ML Society Website

This repository contains the source code for the official website of the QUT AI & ML Society.

The website serves as the central digital platform for the Society, showcasing:
- Events and workshops
- Industry partnerships
- Academic initiatives
- Community engagement
- Member resources

## Purpose

The platform is designed to:
- Promote AI & ML initiatives within QUT
- Provide clear information to prospective members and sponsors
- Highlight technical events and opportunities
- Serve as a long-term digital archive of Society activities

## Homepage statistics

The homepage’s project and event figures are derived at build time from the
current local data folders. They are archive counts, not membership or
attendance figures. No membership or attendance placeholders are displayed.

## About page timeline and stats

The About page reads every numeric `public/data/about/<year>/team-details.json`
file at build time. Each valid year becomes a journey entry, and the newest file
supplies the current-team figure. Its project total and degree-pathway total are
also derived from their respective local data files, while the 700+ Instagram
figure is the already-published value from the Highlights page.

## ML Sandbox

The Projects page includes browser-only mini demos. The K-means visualiser is
plain client-side JavaScript; the digit classifier lazy-loads TensorFlow.js and
the model in `public/models/mnist/` only when its card becomes visible. No user
input is sent to a server.

### Retraining the digit classifier

The checked-in model is a MIT-licensed, MNIST-trained CNN. Its original licence
is retained at `public/models/mnist/LICENSE`. To replace it with a club-trained
version, use Python 3.10–3.12 in a virtual environment:

```bash
python -m pip install tensorflow tensorflowjs
python scripts/train-digit-model.py
```

The script downloads MNIST through Keras, trains a compact CNN, and writes the
TensorFlow.js `model.json` and weight shard to `public/models/mnist/`. Keep that
folder name and file structure unchanged, as the sandbox loads
`/models/mnist/model.json`.

### Adding another sandbox card

Create a self-contained React component in `src/components/sandbox/`, add it to
`SandboxSection.tsx`, and use the shared classes in `sandbox.css`. Heavy
libraries should be dynamically imported inside the component so the Projects
page stays light until a visitor scrolls to the sandbox.

### Neural network lab

The Decision Boundary Playground is a browser-only TensorFlow.js lab. Beginner
view keeps the dataset, learning-rate, optimiser, train/test split, and
play/pause/step/reset controls visible. Advanced view adds per-layer widths,
activation, noise, schedule and comparison controls, loss and simplified
gradient-path views, binary precision/recall/F1 and confusion counts, custom
click-to-add data, challenge presets, and a share-link action. In custom mode,
click the boundary canvas for class 0 and Shift-click for class 1. All values
are kept locally in the browser.

### Maze pathfinding lab

The maze card replaces the former block-stacking planner. It generates solvable
mazes locally, supports keyboard and touch/manual navigation, and animates BFS,
DFS, Dijkstra, or A* over the same maze for direct state-exploration and path
length comparisons.

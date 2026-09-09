# QUT AI & ML Society Website

This repository contains the source code for the official website of the QUT AI & Machine Learning Society.

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

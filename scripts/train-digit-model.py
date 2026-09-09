"""Train an MNIST CNN and export it for the browser sandbox.

Install the dependencies in a virtual environment, then run this file from the
repository root. It overwrites public/models/mnist with fresh TFJS artifacts.
"""
from pathlib import Path
import shutil
import tensorflow as tf
import tensorflowjs as tfjs

OUTPUT = Path("public/models/mnist")

(x_train, y_train), (x_test, y_test) = tf.keras.datasets.mnist.load_data()
x_train = x_train[..., None].astype("float32") / 255
x_test = x_test[..., None].astype("float32") / 255

model = tf.keras.Sequential([
    tf.keras.layers.Input((28, 28, 1)),
    tf.keras.layers.Conv2D(32, 3, activation="relu"),
    tf.keras.layers.MaxPool2D(),
    tf.keras.layers.Conv2D(64, 3, activation="relu"),
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(10, activation="softmax"),
])
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(x_train, y_train, validation_data=(x_test, y_test), epochs=5, batch_size=128)

if OUTPUT.exists():
    shutil.rmtree(OUTPUT)
OUTPUT.mkdir(parents=True)
tfjs.converters.save_keras_model(model, str(OUTPUT))
print(f"Saved TensorFlow.js files to {OUTPUT}")

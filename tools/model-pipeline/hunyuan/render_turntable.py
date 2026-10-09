# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh", "numpy", "matplotlib", "fast-simplification", "scipy", "networkx", "pillow"]
# ///
"""Better contact sheet + turntable GIF of the cleaned mesh (software render)."""
import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image

HERE = Path(__file__).parent
mesh = trimesh.load(HERE / "out" / "puffin_shape_clean.glb", force="mesh")
small = mesh.simplify_quadric_decimation(face_count=30000)
V = small.vertices - small.bounds.mean(axis=0)
F = small.faces
H = V[:, 1].max()  # half height
BG = "#3a3a3a"


def draw(ax, az_deg, elev_deg=8):
    th, ph = np.radians(az_deg), np.radians(elev_deg)
    ry = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
    rx = np.array([[1, 0, 0], [0, np.cos(ph), -np.sin(ph)], [0, np.sin(ph), np.cos(ph)]])
    vr = V @ (rx @ ry).T
    tris = vr[F]
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    visible = n[:, 2] > 0  # back-face culling (camera on +Z)
    key = np.array([0.5, 0.7, 0.8]); key /= np.linalg.norm(key)
    shade = 0.25 + 0.6 * np.clip(n @ key, 0, 1) + 0.25 * np.clip(n[:, 2], 0, 1)
    tris, shade = tris[visible], np.clip(shade[visible], 0, 1)
    order = np.argsort(tris[:, :, 2].mean(1))
    base = np.array([0.93, 0.89, 0.82])  # clay colour
    cols = np.c_[shade[order, None] * base, np.ones(len(order))]
    ax.add_collection3d(Poly3DCollection(tris[order][:, :, [0, 2, 1]], facecolors=cols, linewidths=0))
    r = H * 1.02
    ax.set_xlim(-r, r); ax.set_ylim(-r, r); ax.set_zlim(-r, r)
    ax.view_init(elev=0, azim=-90)
    ax.set_box_aspect((1, 1, 1)); ax.axis("off")
    ax.set_proj_type("ortho")


# Contact sheet: 8 azimuths
fig = plt.figure(figsize=(16, 4.6), facecolor=BG)
for i, az in enumerate(range(0, 360, 45)):
    ax = fig.add_subplot(1, 8, i + 1, projection="3d", facecolor=BG)
    draw(ax, az)
    ax.set_title(f"az{az:03d}_el08", color="w", fontsize=10)
plt.subplots_adjust(0, 0, 1, 0.93, 0, 0)
plt.savefig(HERE / "out" / "puffin_contact_sheet.png", dpi=100, facecolor=BG)
plt.close(fig)
print("🖼️ contact sheet")

# Turntable GIF: 36 frames
frames = []
for az in range(0, 360, 10):
    fig = plt.figure(figsize=(4, 4), facecolor=BG)
    ax = fig.add_subplot(111, projection="3d", facecolor=BG)
    draw(ax, az)
    plt.subplots_adjust(0, 0, 1, 1)
    buf = io.BytesIO(); plt.savefig(buf, dpi=90, facecolor=BG); plt.close(fig)
    frames.append(Image.open(buf).convert("P", palette=Image.ADAPTIVE))
frames[0].save(HERE / "out" / "puffin_turntable.gif", save_all=True, append_images=frames[1:], duration=80, loop=0)
print("🎞️ turntable gif")

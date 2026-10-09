# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh", "numpy", "matplotlib", "fast-simplification", "scipy", "networkx"]
# ///
"""Mini 'Critic' dogfood: geometry checks (spec section A) + 4-view contact sheet."""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

HERE = Path(__file__).parent
mesh = trimesh.load(HERE / "out" / "puffin_shape.glb", force="mesh")

# --- Repair: remove_degenerate (deterministic) -----------------------------
raw_faces = len(mesh.faces)
mesh.update_faces(mesh.nondegenerate_faces())
mesh.remove_unreferenced_vertices()
mesh.merge_vertices()
print(f"🔧 remove_degenerate: {raw_faces} → {len(mesh.faces)} faces")
mesh.export(HERE / "out" / "puffin_shape_clean.glb")

# --- Section A checks ---------------------------------------------------
comps = mesh.split(only_watertight=False)
vols = sorted((abs(c.volume) if c.is_volume else c.area for c in comps), reverse=True)
ext = mesh.extents
report = {
    "faces": int(len(mesh.faces)),
    "vertices": int(len(mesh.vertices)),
    "geo.manifold.watertight": bool(mesh.is_watertight),
    "geo.manifold.winding_consistent": bool(mesh.is_winding_consistent),
    "geo.islands.count": len(comps),
    "geo.islands.tiny(<0.5% of largest)": int(sum(v < 0.005 * vols[0] for v in vols[1:])),
    "geo.scale_axes.extents_xyz": [round(float(e), 3) for e in ext],
    "geo.scale_axes.tallest_axis": "xyz"[int(np.argmax(ext))],
    "geo.grounding.min_y": round(float(mesh.bounds[0][1]), 3),
    "geo.budget.vs_30k_game_preset": f"{len(mesh.faces) / 30000:.1f}x over",
}
# bilateral symmetry: mirror on X, mean nearest distance relative to height
pts = mesh.sample(4000, return_index=False)
mirrored = pts * np.array([-1, 1, 1]) + np.array([2 * mesh.centroid[0], 0, 0])
from scipy.spatial import cKDTree

d, _ = cKDTree(pts).query(mirrored)
report["geo.symmetry.x_mirror_err_pct_of_height"] = round(float(d.mean() / ext[1] * 100), 2)
print(json.dumps(report, indent=2))
(HERE / "out" / "critique_geo.json").write_text(json.dumps(report, indent=2))

# --- Contact sheet -------------------------------------------------------
small = mesh.simplify_quadric_decimation(face_count=25000)
v, f = small.vertices - small.centroid, small.faces
light = np.array([0.4, 0.6, 1.0]) / np.linalg.norm([0.4, 0.6, 1.0])
fig = plt.figure(figsize=(16, 5), facecolor="#2b2b2b")
for i, az in enumerate([0, 90, 180, 270]):
    th = np.radians(az)
    rot = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
    vr = v @ rot.T
    tris = vr[f]
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    shade = np.clip(n @ light, 0.08, 1)
    order = np.argsort(tris[:, :, 2].mean(1))  # painter's algorithm (view from +Z)
    ax = fig.add_subplot(1, 4, i + 1, projection="3d", facecolor="#2b2b2b")
    # map: screen x = X, screen up = Y, depth = Z
    pc = Poly3DCollection(tris[order][:, :, [0, 2, 1]], facecolors=plt.cm.bone(shade[order] * 0.9 + 0.05), linewidths=0)
    ax.add_collection3d(pc)
    r = np.abs(vr).max()
    ax.set_xlim(-r, r); ax.set_ylim(-r, r); ax.set_zlim(-r, r)
    ax.view_init(elev=0, azim=-90)
    ax.set_box_aspect((1, 1, 1)); ax.axis("off")
    ax.set_title(f"az{az:03d}_el00", color="w")
plt.tight_layout()
plt.savefig(HERE / "out" / "puffin_contact_sheet.png", dpi=110, facecolor=fig.get_facecolor())
print("🖼️ contact sheet saved")

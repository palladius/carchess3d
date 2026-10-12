#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright"]
# ///
"""Adversarial Swarm Critic & Verifier (`@adversarial-critic`) for CarChess3D.

Ruthlessly audits all 7 GitHub Issues (#10 through #16) in headless Chromium with WebGL
(SwiftShader ANGLE) and captures diagnostic visual proof in `docs/visual-progress/round6_*.png`:
  - Issue #10: 3D Scazzottata (3D weapon props on fighters, comicWordSprite in Act 2,
               defender counter-attack pose, Act 1/2/3 screenshots)
  - Issue #11: All 36 (6x6) Animations & Videos (.mp4 + .webm) + BattleMatrix36.js +
               standalone `battles.html` + in-game `🎬 Matrice 6×6 (36 Scontri)` modal
  - Issue #12: Visible 3D Skeletons (`TOGGLE_SKELETONS` + `SkeletonRigHelper.js`) &
               2.0s-2.2s articulated locomotion (`c2 -> c4` and `g1 -> f3`)
  - Issue #13: Mac Trackpad 2-Finger Rotate (`wheel` deltaX/deltaY) & Pinch Zoom (`ctrlKey`)
  - Issue #14: White Facing Black (`rotation.y ≈ Math.PI` for 16 White, `≈ 0` for 16 Black)
  - Issue #15: Ogre Swamp Party (`?swamp_party=1` lily pads, ripples & bobbing in West/East moats)
  - Issue #16: Colored Legal Move Dots + Red Capture Target Rings + Capture Preview Toast
"""

from __future__ import annotations

import base64
import functools
import http.server
import json
import math
import os
import pathlib
import shutil
import socketserver
import subprocess
import sys
import threading
import time
from typing import Any

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "visual-progress"
VIDEOS_DIR = ROOT / "assets" / "battles" / "videos"
PIECES = ("k", "q", "b", "n", "r", "p")


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start_static_server() -> tuple[ReusableThreadingTCPServer, int]:
    handler = functools.partial(QuietHTTPRequestHandler, directory=str(ROOT))
    server = ReusableThreadingTCPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def fast_screenshot(page: Any, cdp: Any, out_path: pathlib.Path) -> None:
    """Captures full viewport PNG via CDP Page.captureScreenshot without font/animation hangs."""
    page.wait_for_timeout(120)
    res = cdp.send("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    out_path.write_bytes(base64.b64decode(res["data"]))


def find_node() -> str | None:
    if path := shutil.which("node"):
        return path
    nvm_dir = pathlib.Path.home() / ".nvm/versions/node"
    if nvm_dir.exists():
        candidates = sorted(nvm_dir.glob("*/bin/node"))
        if candidates:
            return str(candidates[-1])
    return None


def audit_issue_11_filesystem() -> dict[str, Any]:
    """Audits Issue #11 disk artifacts: BattleMatrix36.js, 36 .mp4, 36 .webm, battles.html."""
    defects: list[str] = []
    matrix_js = ROOT / "src" / "core" / "BattleMatrix36.js"
    battles_html = ROOT / "battles.html"
    matrix_test = ROOT / "tests" / "matrix36.test.mjs"

    if not matrix_js.exists():
        defects.append("Missing `src/core/BattleMatrix36.js` (@matrix36-choreo)")
    if not battles_html.exists():
        defects.append("Missing `battles.html` in repo root (@explorer6x6-ux)")
    if not matrix_test.exists():
        defects.append("Missing `tests/matrix36.test.mjs` (@matrix36-choreo)")

    mp4_valid = 0
    webm_valid = 0
    missing_videos: list[str] = []
    small_videos: list[str] = []

    for atk in PIECES:
        for dfn in PIECES:
            stem = f"{atk}_x_{dfn}"
            mp4_p = VIDEOS_DIR / f"{stem}.mp4"
            webm_p = VIDEOS_DIR / f"{stem}.webm"
            if not mp4_p.exists():
                missing_videos.append(f"{stem}.mp4")
            elif mp4_p.stat().st_size < 10_000:
                small_videos.append(f"{stem}.mp4 ({mp4_p.stat().st_size}B)")
            else:
                mp4_valid += 1

            if not webm_p.exists():
                missing_videos.append(f"{stem}.webm")
            elif webm_p.stat().st_size < 10_000:
                small_videos.append(f"{stem}.webm ({webm_p.stat().st_size}B)")
            else:
                webm_valid += 1

    if missing_videos:
        defects.append(
            f"Missing {len(missing_videos)} video files in `assets/battles/videos/`: "
            + ", ".join(missing_videos[:8])
        )
    if small_videos:
        defects.append(
            f"Undersized (<10KB) video files in `assets/battles/videos/`: "
            + ", ".join(small_videos[:8])
        )

    # Validate BattleMatrix36.js via Node ESM import if file exists
    matrix_node_info: dict[str, Any] = {}
    node_bin = find_node()
    if matrix_js.exists() and node_bin:
        node_check = subprocess.run(
            [
                node_bin,
                "--input-type=module",
                "-e",
                """
import { BATTLE_MATRIX_36, getBattle36 } from './src/core/BattleMatrix36.js';
const pieces = ['k','q','b','n','r','p'];
let count = 0;
const titles = new Set();
const banners = new Set();
const missingFields = [];
for (const a of pieces) {
  for (const d of pieces) {
    const entry = BATTLE_MATRIX_36?.[a]?.[d] || getBattle36?.(a, d);
    if (!entry) {
      missingFields.push(`${a}_x_${d}:missing`);
      continue;
    }
    count++;
    if (entry.title?.it) titles.add(entry.title.it);
    if (entry.banner?.it) banners.add(entry.banner.it);
    for (const k of ['id','pairSlug','title','banner','attackerWeapon','defenderCounter','clashStyle','finisherReaction','videoUrl','webmUrl']) {
      if (!entry[k]) missingFields.push(`${a}_x_${d}:${k}`);
    }
    if (!entry.defenderCounter?.move || !entry.defenderCounter?.sfxText) {
      missingFields.push(`${a}_x_${d}:defenderCounter_detail`);
    }
  }
}
console.log(JSON.stringify({ count, uniqueTitles: titles.size, uniqueBanners: banners.size, missingFields }));
""",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        if node_check.returncode != 0:
            defects.append(f"`BattleMatrix36.js` Node import failed: {node_check.stderr.strip()}")
        else:
            try:
                matrix_node_info = json.loads(node_check.stdout.strip().splitlines()[-1])
                if matrix_node_info.get("count") != 36:
                    defects.append(f"`BattleMatrix36.js` has {matrix_node_info.get('count')} pairs instead of 36")
                if matrix_node_info.get("uniqueBanners", 0) < 36:
                    defects.append(
                        f"`BattleMatrix36.js` has only {matrix_node_info.get('uniqueBanners')}/36 unique Italian banners"
                    )
                if matrix_node_info.get("missingFields"):
                    defects.append(
                        f"`BattleMatrix36.js` missing fields: {matrix_node_info['missingFields'][:6]}"
                    )
            except Exception as exc:
                defects.append(f"Failed parsing `BattleMatrix36.js` output: {exc}")

    return {
        "mp4_valid": mp4_valid,
        "webm_valid": webm_valid,
        "matrix_node_info": matrix_node_info,
        "defects": defects,
    }


def wait_for_carchess_ready(page: Any, console_errors: list[str], timeout_s: float = 15.0) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        ready = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                if (!c || !c.pieceView || !c.vfxView || !c.boardInteraction || !c.hud) return false;
                return c.pieceView.pieceBySquare.size === 32;
            }"""
        )
        if ready:
            page.wait_for_timeout(800)
            return
        page.wait_for_timeout(150)
    raise RuntimeError(f"window.__CARCHESS__ failed to initialize! Console errors: {console_errors}")


def force_render(page: Any) -> None:
    page.evaluate(
        """() => {
            const c = window.__CARCHESS__;
            if (!c) return;
            c.controls?.update?.();
            if (c.composer) c.composer.render();
            else if (c.renderer && c.scene && c.camera) c.renderer.render(c.scene, c.camera);
        }"""
    )


def run_audit() -> dict[str, Any]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results: dict[str, Any] = {
        "issues": {},
        "screenshots": [],
        "console_errors": [],
    }

    # 1. File-system pre-audit for Issue #11
    fs11 = audit_issue_11_filesystem()

    server, port = start_static_server()
    base_url = f"http://127.0.0.1:{port}"

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--disable-gpu-sandbox",
            ],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        cdp = context.new_cdp_session(page)

        page.on(
            "pageerror",
            lambda err: results["console_errors"].append(f"PAGEERROR: {err}"),
        )
        page.on(
            "console",
            lambda msg: (
                results["console_errors"].append(f"CONSOLE_ERROR: {msg.text}")
                if msg.type == "error" and "favicon" not in msg.text.lower()
                else None
            ),
        )

        # =====================================================================
        # AUDIT A: Main Game (`index.html`) — Issues #14, #13, #16, #12, #10, #11 Modal
        # =====================================================================
        page.goto(f"{base_url}/index.html", wait_until="domcontentloaded")
        wait_for_carchess_ready(page, results["console_errors"])

        # ---------------------------------------------------------------------
        # ISSUE #14: White Facing Black (`rotation.y ≈ Math.PI` vs `0`)
        # ---------------------------------------------------------------------
        issue14 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const pv = c.pieceView;
                let whiteOk = 0;
                let blackOk = 0;
                const bad = [];
                for (const [sq, grp] of pv.pieceBySquare.entries()) {
                    const col = grp.userData.color;
                    const ry = grp.rotation.y;
                    if (col === 'w') {
                        if (Math.abs(ry - Math.PI) < 0.05 && Math.abs((grp.userData.homeYaw ?? 0) - Math.PI) < 0.05) {
                            whiteOk++;
                        } else {
                            bad.push(`${sq}(w): rotY=${ry.toFixed(3)}`);
                        }
                    } else {
                        if (Math.abs(ry - 0) < 0.05 && Math.abs((grp.userData.homeYaw ?? 0) - 0) < 0.05) {
                            blackOk++;
                        } else {
                            bad.push(`${sq}(b): rotY=${ry.toFixed(3)}`);
                        }
                    }
                }
                return { whiteOk, blackOk, bad };
            }"""
        )
        defects14 = []
        if issue14["whiteOk"] != 16 or issue14["blackOk"] != 16:
            defects14.append(
                f"Expected 16 White (rot.y=π) & 16 Black (rot.y=0), got W={issue14['whiteOk']}, B={issue14['blackOk']}: {issue14['bad']}"
            )
        results["issues"]["issue_14_white_facing_black"] = {
            "passed": len(defects14) == 0,
            "details": issue14,
            "defects": defects14,
        }

        # ---------------------------------------------------------------------
        # ISSUE #13: Mac Trackpad 2-Finger Rotate & Pinch Zoom
        # ---------------------------------------------------------------------
        issue13 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const canvas = c.renderer.domElement;
                const getSpherical = () => {
                    const offset = c.camera.position.clone().sub(c.controls.target);
                    const dist = offset.length();
                    const polar = Math.acos(Math.max(-1, Math.min(1, offset.y / Math.max(0.0001, dist))));
                    const azimuth = Math.atan2(offset.x, offset.z);
                    return { dist, polar, azimuth };
                };
                const s0 = getSpherical();

                // 1) 2-Finger Trackpad Swipe (deltaX, deltaY without ctrlKey) -> Orbit Rotate
                canvas.dispatchEvent(new WheelEvent('wheel', {
                    deltaX: 140,
                    deltaY: 90,
                    ctrlKey: false,
                    metaKey: false,
                    bubbles: true,
                    cancelable: true,
                }));
                c.controls.update();
                const s1 = getSpherical();

                // 2) 2-Finger Trackpad Pinch (ctrlKey: true, deltaY < 0) -> Zoom In
                canvas.dispatchEvent(new WheelEvent('wheel', {
                    deltaX: 0,
                    deltaY: -140,
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true,
                }));
                c.controls.update();
                const s2 = getSpherical();

                // Reset sphericalDelta & camera so any NaN bug in wheel handler does not poison later screenshots
                if (c.controls._sphericalDelta) c.controls._sphericalDelta.set(0, 0, 0);
                if (c.controls._panOffset) c.controls._panOffset.set(0, 0, 0);
                c.controls._scale = 1;
                c.camera.position.set(0.0, 5.85, 12.6);
                c.controls.target.set(0.0, 2.15, -2.2);
                c.controls.update();

                return {
                    s0,
                    s1,
                    s2,
                    azimuthDelta: Math.abs(s1.azimuth - s0.azimuth),
                    polarDelta: Math.abs(s1.polar - s0.polar),
                    distDeltaOnRotate: Math.abs(s1.dist - s0.dist),
                    pinchZoomDelta: s1.dist - s2.dist,
                };
            }"""
        )
        defects13 = []
        az_d = issue13.get("azimuthDelta")
        pol_d = issue13.get("polarDelta")
        pinch_d = issue13.get("pinchZoomDelta")
        if az_d is None or pol_d is None or math.isnan(az_d) or math.isnan(pol_d) or az_d < 0.02 or pol_d < 0.02:
            defects13.append(
                f"2-finger wheel swipe failed or produced NaN (`azimuthDelta={az_d}`, `polarDelta={pol_d}`). "
                "Hint: `OrbitControls._customWheelEvent(event)` strips `deltaX`, `ctrlKey`, `metaKey`, `altKey`, `shiftKey`! (@explorer6x6-ux)"
            )
        if pinch_d is None or math.isnan(pinch_d) or pinch_d <= 0.05:
            defects13.append(
                f"2-finger pinch (`ctrlKey+wheel`) failed or produced NaN (`pinchZoomDelta={pinch_d}`) (@explorer6x6-ux)"
            )
        results["issues"]["issue_13_mac_trackpad"] = {
            "passed": len(defects13) == 0,
            "details": issue13,
            "defects": defects13,
        }

        # ---------------------------------------------------------------------
        # ISSUE #12: Visible Skeletons & 2.0s-2.2s Articulated Locomotion (`c2 -> c4` & `g1 -> f3`)
        # ---------------------------------------------------------------------
        issue12 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const { bus, ctx, pieceView } = c;
                const flushAll = () => { for (let i = 0; i < 6; i++) bus.flush(); };

                ctx.board.reset();
                flushAll();

                // Toggle 3D skeletons ON via event bus (or HUD button)
                bus.emit({ type: 'TOGGLE_SKELETONS', visible: true });
                flushAll();

                // Trigger c2 -> c4 (White Pawn), e7 -> e5 (Black Pawn), and g1 -> f3 (White Knight Seby)
                ctx.board.requestMove('c2', 'c4');
                flushAll();
                ctx.board.requestMove('e7', 'e5');
                flushAll();
                ctx.board.requestMove('g1', 'f3');
                flushAll();

                // Advance PieceView by 0.65s so c2->c4 (2.0s) and g1->f3 (2.2s) are mid-stride/mid-gallop!
                pieceView.update(0.65);

                // Frame camera closer to White's front ranks so skeletons & locomotion are crystal clear
                c.camera.position.set(0.4, 3.6, 6.8);
                c.controls.target.set(0.2, 0.7, 1.5);
                c.controls.update();
                if (c.composer) c.composer.render();

                const c4Group = pieceView.getPieceObject('c4');
                const f3Group = pieceView.getPieceObject('f3');
                const c4Rig = c4Group?.userData?.skeletonRig;
                const f3Rig = f3Group?.userData?.skeletonRig;

                const tweenSummary = (pieceView.activeTweens || []).map((tw) => ({
                    kind: tw.kind,
                    pieceType: tw.pieceType,
                    duration: tw.duration,
                    elapsed: tw.elapsed,
                }));

                const checkRig = (rig) => {
                    if (!rig) return null;
                    const joints = rig.userData?.joints || rig.joints || {};
                    const jointNames = Object.keys(joints);
                    return {
                        visible: Boolean(rig.visible),
                        childCount: rig.children?.length || 0,
                        jointNames,
                        leftLegRotX: joints.leftLeg?.rotation?.x ?? null,
                        rightLegRotX: joints.rightLeg?.rotation?.x ?? null,
                        frontLeftLegRotX: joints.frontLeftLeg?.rotation?.x ?? null,
                        hindLeftLegRotX: joints.hindLeftLeg?.rotation?.x ?? null,
                    };
                };

                const hudSkeletonBtn = Boolean(
                    document.querySelector('#hud-skeletons-btn, [data-action="toggle-skeletons"], #hud-btn-skeletons') ||
                    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Scheletri'))
                );

                return {
                    skeletonsVisibleFlag: Boolean(pieceView.skeletonsVisible),
                    hudSkeletonBtn,
                    tweenSummary,
                    c4Rig: checkRig(c4Rig),
                    f3Rig: checkRig(f3Rig),
                };
            }"""
        )
        shot_12 = OUT_DIR / "round6_2_skeletons_walk_gallop.png"
        fast_screenshot(page, cdp, shot_12)
        results["screenshots"].append(str(shot_12.relative_to(ROOT)))

        defects12 = []
        if not (ROOT / "src" / "views" / "SkeletonRigHelper.js").exists():
            defects12.append("Missing `src/views/SkeletonRigHelper.js` (@skeletons-locomotion)")
        if not issue12["c4Rig"] or not issue12["f3Rig"]:
            defects12.append(
                f"`group.userData.skeletonRig` missing on moving pieces (`c4Rig={issue12['c4Rig']}`, `f3Rig={issue12['f3Rig']}`) (@skeletons-locomotion)"
            )
        else:
            if not issue12["c4Rig"]["visible"] or not issue12["f3Rig"]["visible"]:
                defects12.append("`skeletonRig.visible` is false after `TOGGLE_SKELETONS` (@skeletons-locomotion)")
            if not issue12["c4Rig"]["leftLegRotX"] and issue12["c4Rig"]["leftLegRotX"] != 0:
                defects12.append("`c4Rig` missing articulated `leftLeg` joint (@skeletons-locomotion)")
            elif abs(issue12["c4Rig"]["leftLegRotX"] or 0) < 0.01:
                defects12.append("`c4Rig` `leftLeg.rotation.x` is static (0.0) during walk (@skeletons-locomotion)")
            if "frontLeftLeg" not in (issue12["f3Rig"]["jointNames"] or []):
                defects12.append("Knight `f3Rig` missing 4-legged warhorse `frontLeftLeg` joint (@skeletons-locomotion)")
        if not issue12["hudSkeletonBtn"]:
            defects12.append("Bottom HUD bar missing `🦴 Scheletri 3D` button (@explorer6x6-ux)")

        results["issues"]["issue_12_skeletons_locomotion"] = {
            "passed": len(defects12) == 0,
            "details": issue12,
            "defects": defects12,
        }

        # ---------------------------------------------------------------------
        # ISSUE #16: Colored Legal Move Dots + Red Capture Target Rings + Preview
        # ---------------------------------------------------------------------
        issue16 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const { bus, ctx, boardInteraction, pieceView } = c;
                const flushAll = () => { for (let i = 0; i < 6; i++) bus.flush(); };

                // Turn skeletons off for clean legal dots screenshot
                bus.emit({ type: 'TOGGLE_SKELETONS', visible: false });
                ctx.board.reset();
                flushAll();

                // Set up e4 vs d5 so e4 has both empty move (e5) AND capture (d5)!
                ctx.board.requestMove('e2', 'e4');
                flushAll();
                ctx.board.requestMove('d7', 'd5');
                flushAll();
                // Finish active locomotion tweens so pieces sit cleanly on e4 and d5
                pieceView.update(2.5);
                pieceView.update(0.5);

                // Select White pawn on e4 (has legal empty move e5 and legal capture exd5!)
                ctx.board.selectSquare('e4');
                flushAll();
                boardInteraction.update(0.25);

                // Trigger capture hover preview
                if (typeof boardInteraction.previewCaptureAtSquare === 'function') {
                    boardInteraction.previewCaptureAtSquare('d5');
                } else {
                    bus.emit({
                        type: 'CAPTURE_PREVIEW_HOVER',
                        from: 'e4',
                        to: 'd5',
                        attacker: 'p',
                        defender: 'p',
                    });
                }
                flushAll();

                // Frame board from an elevated tactical angle so pulsing dots & red target ring pop
                c.camera.position.set(0.0, 6.2, 8.8);
                c.controls.target.set(0.0, 0.4, -0.5);
                c.controls.update();
                if (c.composer) c.composer.render();

                return {
                    selectedSquare: ctx.board.selectedSquare,
                    pulsingCirclesCount: boardInteraction.pulsingCircles?.length || 0,
                    rotatingCaptureRingsCount: boardInteraction.rotatingCaptureRings?.length || 0,
                    hasSelectedRing: Boolean(boardInteraction.selectedRingMesh),
                    lastToast: c.hud?.lastToast || null,
                };
            }"""
        )
        shot_16 = OUT_DIR / "round6_3_legal_dots_and_brawl.png"
        fast_screenshot(page, cdp, shot_16)
        results["screenshots"].append(str(shot_16.relative_to(ROOT)))

        defects16 = []
        if issue16["pulsingCirclesCount"] < 1:
            defects16.append("No pulsing legal move circles rendered for `e4` (@explorer6x6-ux)")
        if issue16["rotatingCaptureRingsCount"] < 1:
            defects16.append("No rotating red capture target rings rendered for `e4xd5` (@explorer6x6-ux)")
        results["issues"]["issue_16_legal_move_dots"] = {
            "passed": len(defects16) == 0,
            "details": issue16,
            "defects": defects16,
        }

        # ---------------------------------------------------------------------
        # ISSUE #10: 3-Act 3D Scazzottata (`e4xd5` and `b_n`) with 3D Weapons,
        #            Comic Word Sprite, Defender Counter-Attack, and Swamp K.O.
        # ---------------------------------------------------------------------
        # Execute real board capture e4xd5 and inspect Act 1, Act 2, Act 3!
        issue10_act1 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const { bus, ctx, vfxView, cinemaView } = c;
                const flushAll = () => { for (let i = 0; i < 6; i++) bus.flush(); };

                ctx.board.requestMove('e4', 'd5');
                flushAll();

                // Set clashElapsed to Act 1 (0.30s -> t ≈ 0.12 < 0.25, strictly Act 1 CHARGE!)
                vfxView.clashElapsed = 0.0;
                for (let i = 0; i < 3; i++) vfxView.update(0.1);
                cinemaView.update(0.3);
                if (c.composer) c.composer.render();

                const atk = vfxView.attackerFighter;
                const def = vfxView.defenderFighter;
                return {
                    hasActiveClash: Boolean(vfxView.activeClash),
                    attackerPresent: Boolean(atk && atk.parent === vfxView.brawlStageGroup),
                    defenderPresent: Boolean(def && def.parent === vfxView.brawlStageGroup),
                    attackerWeaponProp: Boolean(atk?.userData?.weaponProp || vfxView.attackerWeaponProp),
                    defenderWeaponProp: Boolean(def?.userData?.weaponProp || vfxView.defenderWeaponProp),
                };
            }"""
        )
        shot_10_act1 = OUT_DIR / "round6_4_brawl_act1_charge.png"
        fast_screenshot(page, cdp, shot_10_act1)
        results["screenshots"].append(str(shot_10_act1.relative_to(ROOT)))

        # Advance into Act 2 (Defender Counter-Attack & Brawl + Comic Word Sprite)
        # Also test `b` vs `n` (Ale vs Seby) for Act 2 screenshot
        issue10_act2 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const { bus, vfxView, cinemaView } = c;
                // Advance e4xd5 to t = 0.42 (1.68s -> Exchange 2 Defender Counter-Attack!)
                vfxView.clashElapsed = 1.58;
                vfxView.update(0.1);
                cinemaView.update(0.5);

                const atkP = vfxView.attackerFighter;
                const defP = vfxView.defenderFighter;
                const e4xd5State = {
                    comicSpriteExists: Boolean(vfxView.props?.comicWordSprite?.isSprite),
                    comicSpriteVisible: Boolean(vfxView.props?.comicWordSprite?.visible),
                    comicWordText: vfxView.props?.comicWordSprite?.userData?.lastWord || null,
                    brawlCloudVisible: Boolean(vfxView.props?.brawlCloud?.visible),
                    defenderCounterActive: Boolean(
                        defP && (
                            Math.abs(defP.userData?.bodyContainer?.rotation?.x || 0) > 0.05 ||
                            (defP.userData?.locomotionUniforms?.uCombatAmp?.value || 0) > 0.5 ||
                            defP.userData?.counterAttackActive
                        )
                    ),
                };

                // Now trigger `b` vs `n` (Bishop Ale vs Knight Seby) and step to Act 2 Counter-Attack (t = 0.42)
                bus.emit({
                    type: 'WOW_ARENA_CLASH',
                    attacker: 'b',
                    defender: 'n',
                    tier: 'golden_crit',
                    square: 'd5',
                    from: 'c4',
                    to: 'd5',
                    durationMs: 4000,
                });
                bus.flush();
                bus.flush();
                vfxView.clashElapsed = 1.58;
                vfxView.update(0.1);
                cinemaView.update(0.5);
                if (c.composer) c.composer.render();

                const atkB = vfxView.attackerFighter;
                const defN = vfxView.defenderFighter;
                return {
                    e4xd5State,
                    bnAttackerWeapon: Boolean(atkB?.userData?.weaponProp || atkB?.getObjectByName?.('FighterWeaponProp')),
                    bnDefenderWeapon: Boolean(defN?.userData?.weaponProp || defN?.getObjectByName?.('FighterWeaponProp')),
                    bnComicVisible: Boolean(vfxView.props?.comicWordSprite?.visible),
                };
            }"""
        )
        shot_10_act2 = OUT_DIR / "round6_5_brawl_act2_counterattack.png"
        fast_screenshot(page, cdp, shot_10_act2)
        results["screenshots"].append(str(shot_10_act2.relative_to(ROOT)))

        # Advance into Act 3 (t = 0.90 -> 3.60s of 4.0s: Knockout Launch + Swamp Water Splash!)
        issue10_act3 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const { vfxView, cinemaView } = c;
                vfxView.clashElapsed = 3.50;
                vfxView.update(0.1);
                cinemaView.update(0.5);
                if (c.composer) c.composer.render();

                const def = vfxView.defenderFighter;
                return {
                    defenderPos: def ? { x: def.position.x, y: def.position.y, z: def.position.z } : null,
                    swampSplashVisible: Boolean(
                        vfxView.props?.swampKoSplash?.visible ||
                        vfxView.props?.swampSplashRing?.visible ||
                        vfxView.swampSplashActive
                    ),
                };
            }"""
        )
        shot_10_act3 = OUT_DIR / "round6_6_brawl_act3_swamp_ko.png"
        fast_screenshot(page, cdp, shot_10_act3)
        results["screenshots"].append(str(shot_10_act3.relative_to(ROOT)))

        defects10 = []
        if not issue10_act1["attackerWeaponProp"] or not issue10_act1["defenderWeaponProp"]:
            defects10.append(
                f"Fighters in `e4xd5` missing 3D weapon props (`attackerWeaponProp={issue10_act1['attackerWeaponProp']}`, `defenderWeaponProp={issue10_act1['defenderWeaponProp']}`) (@brawl3d-vfx)"
            )
        if not issue10_act2["bnAttackerWeapon"] or not issue10_act2["bnDefenderWeapon"]:
            defects10.append(
                f"Fighters in `b_n` clash missing 3D weapon props (`bnAttackerWeapon={issue10_act2['bnAttackerWeapon']}`, `bnDefenderWeapon={issue10_act2['bnDefenderWeapon']}`) (@brawl3d-vfx)"
            )
        if not issue10_act2["e4xd5State"]["comicSpriteExists"] or not issue10_act2["e4xd5State"]["comicSpriteVisible"]:
            defects10.append(
                f"`vfxView.props.comicWordSprite` missing or not visible in Act 2 (`{issue10_act2['e4xd5State']}`) (@brawl3d-vfx)"
            )
        if not issue10_act3["swampSplashVisible"]:
            defects10.append(
                "3D Ogre Swamp water splash ring (`swampKoSplash` / `swampSplashRing`) not triggered in Act 3 (@brawl3d-vfx)"
            )

        results["issues"]["issue_10_3d_scazzottata"] = {
            "passed": len(defects10) == 0,
            "details": {
                "act1": issue10_act1,
                "act2": issue10_act2,
                "act3": issue10_act3,
            },
            "defects": defects10,
        }

        # ---------------------------------------------------------------------
        # ISSUE #11 (In-Game Modal): Click `🎬 Matrice 6×6 (36 Scontri)` button
        # ---------------------------------------------------------------------
        issue11_modal = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                c.bus.emit({ type: 'BATTLE_SKIPPED' });
                c.bus.flush();

                const buttons = Array.from(document.querySelectorAll('button'));
                const matrixBtn = buttons.find((b) =>
                    b.textContent.includes('Matrice 6×6') ||
                    b.textContent.includes('Matrice 6x6') ||
                    b.textContent.includes('36 Scontri') ||
                    b.dataset?.action === 'open-matrix-6x6'
                );
                if (!matrixBtn) {
                    return { buttonFound: false, cellCount: 0, marathonBtnFound: false };
                }
                matrixBtn.click();

                const cells = document.querySelectorAll(
                    '[data-matrix-cell], .matrix-6x6-cell, [data-matrix-pair], .hud-matrix-cell, .matrix36-cell'
                );
                const allButtonsAfter = Array.from(document.querySelectorAll('button, a'));
                const marathonBtn = allButtonsAfter.find((b) =>
                    b.textContent.includes('Maratona') || b.textContent.includes('Riproduci Tutti')
                );
                const battlesLink = allButtonsAfter.find((b) =>
                    (b.getAttribute('href') || '').includes('battles.html') ||
                    b.textContent.includes('battles.html')
                );
                return {
                    buttonFound: true,
                    buttonText: matrixBtn.textContent.trim(),
                    cellCount: cells.length,
                    marathonBtnFound: Boolean(marathonBtn),
                    battlesLinkFound: Boolean(battlesLink),
                };
            }"""
        )
        page.wait_for_timeout(200)
        shot_11_modal = OUT_DIR / "round6_1_matrix_6x6_modal.png"
        fast_screenshot(page, cdp, shot_11_modal)
        results["screenshots"].append(str(shot_11_modal.relative_to(ROOT)))

        # =====================================================================
        # AUDIT B: Issue #15 (`?swamp_party=1`) — Ogre Swamp Party & Lily Pads
        # =====================================================================
        issue15 = page.evaluate(
            """() => {
                const c = window.__CARCHESS__;
                const { bus, ctx, pieceView } = c;

                // Close 6x6 modal if open
                const modal = document.getElementById('hud-matrix36-modal');
                if (modal) modal.style.display = 'none';
                c.hud?.closeMatrix36Modal?.();

                ctx.board.reset();
                bus.flush();
                bus.flush();

                for (const [color, victimColor, atk, def, sq] of [
                    ['b', 'w', 'n', 'b', 'c1'],
                    ['b', 'w', 'b', 'n', 'g1'],
                    ['b', 'w', 'r', 'p', 'e2'],
                    ['w', 'b', 'b', 'n', 'b8'],
                    ['w', 'b', 'n', 'b', 'f8'],
                    ['w', 'b', 'q', 'r', 'h8'],
                ]) {
                    ctx.pieces.handlePieceCaptured({
                        color,
                        victimColor,
                        attacker: atk,
                        defender: def,
                        capturedSquare: sq,
                    });
                }
                ctx.pieces.emitPiecesSynced('swamp_party');
                bus.flush();
                bus.flush();

                pieceView.update(0.45);
                const swimmers = pieceView.trayGroup.children || [];
                let westCount = 0;
                let eastCount = 0;
                let withSplashAndLily = 0;
                let withLilyPad = 0;
                let withLotus = 0;
                for (const s of swimmers) {
                    if (s.position.x < -5.5) westCount++;
                    if (s.position.x > 5.5) eastCount++;
                    const sp = s.userData?.swampSplash;
                    if (sp && sp.children.length >= 3) {
                        withSplashAndLily++;
                    }
                    if (s.userData?.lilyPad || sp?.userData?.lilyPad || s.getObjectByName?.('SwampLilyPad')) {
                        withLilyPad++;
                    }
                    if (s.userData?.lotusFlower || sp?.userData?.lotusFlower || s.getObjectByName?.('SwampLotusFlower')) {
                        withLotus++;
                    }
                }
                // Frame the West Swamp Moat + Board edge so swimming pieces & lily pads are clearly visible
                c.camera.position.set(-8.6, 3.8, 4.8);
                c.controls.target.set(-6.5, -0.2, -0.8);
                c.controls.update();
                if (c.composer) c.composer.render();
                return {
                    swimmerCount: swimmers.length,
                    westCount,
                    eastCount,
                    withSplashAndLily,
                    withLilyPad,
                    withLotus,
                };
            }"""
        )
        shot_15 = OUT_DIR / "round6_8_swamp_party_lilypads.png"
        fast_screenshot(page, cdp, shot_15)
        results["screenshots"].append(str(shot_15.relative_to(ROOT)))

        defects15 = []
        if issue15["swimmerCount"] < 6 or issue15["westCount"] < 3 or issue15["eastCount"] < 3:
            defects15.append(
                f"Expected >=6 swamp swimmers split across West/East moats, got {issue15}"
            )
        if issue15["withLilyPad"] < 6:
            defects15.append(
                f"Expected 3D lily pads under all 6 swamp swimmers, got withLilyPad={issue15['withLilyPad']}"
            )
        results["issues"]["issue_15_ogre_swamp_party"] = {
            "passed": len(defects15) == 0,
            "details": issue15,
            "defects": defects15,
        }

        # =====================================================================
        # AUDIT C: Issue #11 (`battles.html`) — Standalone 6x6 Video Explorer
        # =====================================================================
        battles_html_details: dict[str, Any] = {"exists": (ROOT / "battles.html").exists()}
        if battles_html_details["exists"]:
            resp = page.goto(f"{base_url}/battles.html", wait_until="domcontentloaded")
            page.wait_for_timeout(400)
            battles_html_details = page.evaluate(
                """() => {
                    const videos = Array.from(document.querySelectorAll('video'));
                    const cards = document.querySelectorAll('[data-pair], .battle-card, .matrix-card, article');
                    const links = Array.from(document.querySelectorAll('a')).filter((a) =>
                        (a.getAttribute('href') || '').includes('clash=')
                    );
                    const filterBtns = Array.from(document.querySelectorAll('button')).filter((b) =>
                        /Tutti|Riccardo|Kate|Ale|Seby|Pupurabbu|Puffin/i.test(b.textContent)
                    );
                    return {
                        exists: true,
                        videoCount: videos.length,
                        cardCount: cards.length,
                        clashLinkCount: links.length,
                        filterTabCount: filterBtns.length,
                    };
                }"""
            )
            battles_html_details["httpStatus"] = resp.status if resp else 0
            shot_11_battles = OUT_DIR / "round6_7_battles_html_explorer.png"
            fast_screenshot(page, cdp, shot_11_battles)
            results["screenshots"].append(str(shot_11_battles.relative_to(ROOT)))

        defects11 = list(fs11["defects"])
        if not issue11_modal["buttonFound"]:
            defects11.append("In-game HUD button `🎬 Matrice 6×6 (36 Scontri)` not found (@explorer6x6-ux)")
        elif issue11_modal["cellCount"] < 36:
            defects11.append(
                f"In-game 6×6 modal rendered {issue11_modal['cellCount']} cells instead of 36 (@explorer6x6-ux)"
            )
        if battles_html_details.get("exists"):
            if battles_html_details.get("videoCount", 0) < 36:
                defects11.append(
                    f"`battles.html` rendered {battles_html_details.get('videoCount')} `<video>` elements (expected 36) (@explorer6x6-ux)"
                )
            if battles_html_details.get("clashLinkCount", 0) < 36:
                defects11.append(
                    f"`battles.html` has {battles_html_details.get('clashLinkCount')} `?clash=` deep-links (expected 36) (@explorer6x6-ux)"
                )

        results["issues"]["issue_11_matrix_36_videos_and_explorer"] = {
            "passed": len(defects11) == 0,
            "details": {
                "filesystem": fs11,
                "inGameModal": issue11_modal,
                "battlesHtml": battles_html_details,
            },
            "defects": defects11,
        }

        browser.close()

    server.shutdown()
    return results


def main() -> None:
    report = run_audit()
    all_passed = all(v["passed"] for v in report["issues"].values()) and len(report["console_errors"]) == 0
    report["all_passed"] = all_passed
    print(json.dumps(report, indent=2))
    os._exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()

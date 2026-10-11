/**
 * @fileoverview Articulated 3D Hierarchical Skeleton & Joint Visual Rig (`SkeletonRigHelper`).
 *
 * Implements Issue #12 ("Scheletri visibili e Locomozione Articolata 2.0s-2.4s"):
 * - Builds an articulated 3D hierarchical skeleton & joint visual rig (`createArticulatedSkeletonRig`)
 *   attached to every piece group (`group.userData.skeletonRig`).
 * - Contains real `THREE.Group` / `THREE.Bone`-style pivot joints:
 *   `pelvis`, `spine`, `head`, `leftLeg`, `rightLeg`, `leftArm`, `rightArm`,
 *   plus for Knight Seby (`n`) a 4-legged warhorse skeleton
 *   (`horseChest`, `frontLeftLeg`, `frontRightLeg`, `hindLeftLeg`, `hindRightLeg`, `horseHead`),
 *   and for Bishop Ale (`b`) articulated dragon wing joints (`leftWing`, `rightWing`).
 * - Renders glowing cyan/gold bone segments, joint spheres, and holographic footstep/hoofprint rings
 *   (`visible` controlled by `pieceView.skeletonsVisible`, OR automatically pulsing at ~35%
 *   holographic opacity while a piece is actively walking, galloping, or brawling).
 * - Exposes `updateSkeletonRigPose(rig, pieceType, pose)` which rotates the 3D leg, knee, arm,
 *   elbow, horse-hoof, and dragon-wing joints in sync with `walkPhase`, `walkAmp`,
 *   `combatPhase`, `combatAmp`, and `rearUp`.
 */

import { CANONICAL_PIECE_HEIGHTS, PEDESTAL_HEIGHT } from '../utils/glbGrounding.js';

/**
 * Helper to create a bone pivot group tagged as both a `THREE.Group` and a `THREE.Bone`-style joint.
 * @param {typeof import('three')} THREE
 * @param {string} name
 * @param {number} [x=0]
 * @param {number} [y=0]
 * @param {number} [z=0]
 * @returns {import('three').Group}
 */
function createPivotJoint(THREE, name, x = 0, y = 0, z = 0) {
  const joint = new THREE.Group();
  joint.name = name;
  joint.isBone = true;
  joint.position.set(x, y, z);
  return joint;
}

/**
 * Helper to create a glowing bone segment between two local points `(0,0,0)` and `(dx, dy, dz)`.
 * @param {typeof import('three')} THREE
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} radiusTop
 * @param {number} radiusBottom
 * @param {import('three').Material} material
 * @returns {import('three').Mesh}
 */
function createBoneSegmentMesh(THREE, dx, dy, dz, radiusTop, radiusBottom, material) {
  const len = Math.max(0.02, Math.hypot(dx, dy, dz));
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 8);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(dx * 0.5, dy * 0.5, dz * 0.5);

  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  if (dir.lengthSq() > 1e-6) {
    mesh.quaternion.setFromUnitVectors(up, dir);
  }
  mesh.renderOrder = 14;
  return mesh;
}

/**
 * Builds an articulated 3D hierarchical skeleton & joint visual rig for a chess piece.
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType - `'p' | 'r' | 'n' | 'b' | 'q' | 'k'`
 * @param {number} [pieceHeight] - Total canonical height in meters
 * @param {'w'|'b'} [color='w'] - Faction color (`'w'` or `'b'`)
 * @returns {import('three').Group & Record<string, any>}
 */
export function createArticulatedSkeletonRig(THREE, pieceType = 'p', pieceHeight = 0, color = 'w') {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const totalHeight =
    pieceHeight > 0 ? pieceHeight : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);
  const baseY = PEDESTAL_HEIGHT;
  const bodySpan = Math.max(0.56, totalHeight - baseY);

  const rig = new THREE.Group();
  rig.name = `ArticulatedSkeletonRig_${color}_${type}`;
  rig.isSkeletonRig = true;

  // Shared per-piece holographic materials (depthTest: false so bones & joints shine clearly through GLB meshes)
  const cyanBoneColor = isWhite ? 0x00f0ff : 0x40c4ff;
  const goldJointColor = isWhite ? 0xffd740 : 0xffab00;
  const accentWingColor = type === 'b' ? 0xff5252 : type === 'n' ? 0xff9100 : cyanBoneColor;

  const boneMat = new THREE.MeshBasicMaterial({
    color: cyanBoneColor,
    transparent: true,
    opacity: 0.88,
    depthTest: false,
    depthWrite: false,
  });

  const secondaryBoneMat = new THREE.MeshBasicMaterial({
    color: accentWingColor,
    transparent: true,
    opacity: 0.84,
    depthTest: false,
    depthWrite: false,
  });

  const jointMat = new THREE.MeshBasicMaterial({
    color: goldJointColor,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
  });

  const footprintMat = new THREE.MeshBasicMaterial({
    color: isWhite ? 0x00e5ff : 0xffd740,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
  });

  const jointSphereGeo = new THREE.SphereGeometry(0.036, 10, 10);
  const smallJointGeo = new THREE.SphereGeometry(0.028, 8, 8);

  const addJointSphere = (parent, x = 0, y = 0, z = 0, scale = 1.0) => {
    const s = new THREE.Mesh(jointSphereGeo, jointMat);
    s.position.set(x, y, z);
    if (scale !== 1.0) s.scale.setScalar(scale);
    s.renderOrder = 15;
    parent.add(s);
    return s;
  };

  // ===========================================================================
  // 1. PELVIS, LEGS & FEET HIERARCHY
  // ===========================================================================
  const isKnight = type === 'n';
  const basePelvisY = isKnight ? baseY + bodySpan * 0.46 : baseY + bodySpan * 0.42;
  const basePelvisZ = isKnight ? -0.03 : 0.0;
  const pelvis = createPivotJoint(THREE, 'pelvis', 0, basePelvisY, basePelvisZ);
  rig.add(pelvis);

  const hipWidth = isKnight ? 0.11 : Math.min(0.14, 0.085 + bodySpan * 0.04);
  addJointSphere(pelvis, 0, 0, 0, 1.15);
  pelvis.add(createBoneSegmentMesh(THREE, hipWidth * 2, 0, 0, 0.02, 0.02, boneMat));

  // Glowing pelvis ring
  const pelvisRing = new THREE.Mesh(
    new THREE.TorusGeometry(hipWidth * 1.05, 0.012, 8, 20),
    boneMat,
  );
  pelvisRing.rotation.x = Math.PI * 0.5;
  pelvisRing.renderOrder = 14;
  pelvis.add(pelvisRing);

  const legTotalLen = Math.max(0.22, basePelvisY - baseY - 0.02);
  const thighLen = legTotalLen * 0.52;
  const shinLen = legTotalLen * 0.48;

  const buildBipedLeg = (sideSign, labelPrefix) => {
    const hipJoint = createPivotJoint(THREE, `${labelPrefix}Leg`, sideSign * hipWidth, 0, 0);
    addJointSphere(hipJoint, 0, 0, 0, 0.95);
    hipJoint.add(createBoneSegmentMesh(THREE, 0, -thighLen, 0, 0.022, 0.018, boneMat));

    const kneeJoint = createPivotJoint(THREE, `${labelPrefix}Knee`, 0, -thighLen, 0);
    addJointSphere(kneeJoint, 0, 0, 0, 0.85);
    kneeJoint.add(createBoneSegmentMesh(THREE, 0, -shinLen, 0, 0.018, 0.015, boneMat));

    const ankleJoint = createPivotJoint(THREE, `${labelPrefix}Ankle`, 0, -shinLen, 0);
    addJointSphere(ankleJoint, 0, 0, 0, 0.78);
    // Forward-pointing foot bone (+Z is character forward)
    ankleJoint.add(createBoneSegmentMesh(THREE, 0, -0.01, 0.085, 0.015, 0.012, secondaryBoneMat));

    // Glowing footstep ring under the foot
    const footRing = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.068, 16), footprintMat);
    footRing.rotation.x = -Math.PI * 0.5;
    footRing.position.set(0, -0.015, 0.03);
    footRing.renderOrder = 15;
    ankleJoint.add(footRing);

    kneeJoint.add(ankleJoint);
    hipJoint.add(kneeJoint);
    pelvis.add(hipJoint);
    return { hipJoint, kneeJoint, ankleJoint, footRing };
  };

  const leftLegParts = buildBipedLeg(-1, 'left');
  const rightLegParts = buildBipedLeg(1, 'right');
  const leftLeg = leftLegParts.hipJoint;
  const rightLeg = rightLegParts.hipJoint;
  const leftKnee = leftLegParts.kneeJoint;
  const rightKnee = rightLegParts.kneeJoint;

  // ===========================================================================
  // 2. SPINE, RIBCAGE, ARMS & HEAD HIERARCHY
  // ===========================================================================
  const spineLen = bodySpan * (isKnight ? 0.25 : 0.30);
  const spine = createPivotJoint(THREE, 'spine', 0, 0.02, 0);
  pelvis.add(spine);

  spine.add(createBoneSegmentMesh(THREE, 0, spineLen, 0, 0.024, 0.02, boneMat));
  addJointSphere(spine, 0, spineLen * 0.5, 0, 0.9);
  addJointSphere(spine, 0, spineLen, 0, 1.1);

  // Ribcage holographic hoop
  const ribRing = new THREE.Mesh(
    new THREE.TorusGeometry(hipWidth * 1.18, 0.013, 8, 20),
    boneMat,
  );
  ribRing.rotation.x = Math.PI * 0.42;
  ribRing.position.y = spineLen * 0.62;
  ribRing.renderOrder = 14;
  spine.add(ribRing);

  const shoulderY = spineLen * 0.88;
  const shoulderWidth = Math.min(0.18, hipWidth * 1.38);
  const clavicle = createBoneSegmentMesh(THREE, shoulderWidth * 2, 0, 0, 0.018, 0.018, boneMat);
  clavicle.position.y = shoulderY;
  spine.add(clavicle);

  const upperArmLen = bodySpan * 0.17;
  const foreArmLen = bodySpan * 0.15;

  const buildArm = (sideSign, labelPrefix) => {
    const shoulderJoint = createPivotJoint(
      THREE,
      `${labelPrefix}Arm`,
      sideSign * shoulderWidth,
      shoulderY,
      0,
    );
    addJointSphere(shoulderJoint, 0, 0, 0, 0.9);
    shoulderJoint.add(
      createBoneSegmentMesh(THREE, sideSign * 0.02, -upperArmLen, 0, 0.018, 0.015, boneMat),
    );

    const elbowJoint = createPivotJoint(
      THREE,
      `${labelPrefix}Elbow`,
      sideSign * 0.02,
      -upperArmLen,
      0,
    );
    addJointSphere(elbowJoint, 0, 0, 0, 0.8);
    elbowJoint.add(
      createBoneSegmentMesh(THREE, 0, -foreArmLen * 0.7, foreArmLen * 0.65, 0.015, 0.013, boneMat),
    );

    const handSphere = new THREE.Mesh(smallJointGeo, jointMat);
    handSphere.position.set(0, -foreArmLen * 0.7, foreArmLen * 0.65);
    handSphere.renderOrder = 15;
    elbowJoint.add(handSphere);

    // For right arm, add a skeletal weapon-bone extension so slashes are extra readable
    if (sideSign > 0) {
      const weaponBone = createBoneSegmentMesh(
        THREE,
        0,
        0.16,
        0.14,
        0.012,
        0.008,
        secondaryBoneMat,
      );
      weaponBone.position.copy(handSphere.position);
      elbowJoint.add(weaponBone);
    }

    shoulderJoint.add(elbowJoint);
    spine.add(shoulderJoint);
    return { shoulderJoint, elbowJoint };
  };

  const leftArmParts = buildArm(-1, 'left');
  const rightArmParts = buildArm(1, 'right');
  const leftArm = leftArmParts.shoulderJoint;
  const rightArm = rightArmParts.shoulderJoint;
  const leftElbow = leftArmParts.elbowJoint;
  const rightElbow = rightArmParts.elbowJoint;

  // Head & Neck joint
  const head = createPivotJoint(THREE, 'head', 0, spineLen, 0);
  const neckLen = bodySpan * 0.09;
  head.add(createBoneSegmentMesh(THREE, 0, neckLen, 0, 0.018, 0.016, boneMat));
  const skullSphere = addJointSphere(head, 0, neckLen + 0.055, 0, 1.55);
  // Forward gaze nose/visor bone (+Z forward indicator for Issue #14 verification)
  const gazeBone = createBoneSegmentMesh(THREE, 0, 0, 0.095, 0.014, 0.006, secondaryBoneMat);
  gazeBone.position.set(0, neckLen + 0.055, 0.02);
  head.add(gazeBone);
  spine.add(head);

  // ===========================================================================
  // 3. BISHOP ALE ('b'): ARTICULATED DRAGON WING JOINTS (leftWing, rightWing)
  // ===========================================================================
  const leftWing = createPivotJoint(THREE, 'leftWing', -shoulderWidth * 0.75, shoulderY, -0.05);
  const rightWing = createPivotJoint(THREE, 'rightWing', shoulderWidth * 0.75, shoulderY, -0.05);
  spine.add(leftWing, rightWing);

  if (type === 'b') {
    const buildDragonWingBones = (wingRoot, sideSign) => {
      addJointSphere(wingRoot, 0, 0, 0, 0.88);
      const spar1 = createBoneSegmentMesh(
        THREE,
        sideSign * 0.22,
        0.14,
        -0.05,
        0.018,
        0.014,
        secondaryBoneMat,
      );
      wingRoot.add(spar1);
      const wingTip = addJointSphere(wingRoot, sideSign * 0.22, 0.14, -0.05, 0.85);
      const spar2 = createBoneSegmentMesh(
        THREE,
        sideSign * 0.18,
        -0.08,
        -0.06,
        0.014,
        0.008,
        boneMat,
      );
      spar2.position.copy(wingTip.position);
      const feather1 = createBoneSegmentMesh(
        THREE,
        sideSign * 0.08,
        -0.20,
        -0.04,
        0.012,
        0.006,
        secondaryBoneMat,
      );
      feather1.position.copy(wingTip.position);
      const feather2 = createBoneSegmentMesh(
        THREE,
        sideSign * 0.16,
        -0.18,
        -0.05,
        0.012,
        0.006,
        secondaryBoneMat,
      );
      feather2.position.copy(wingTip.position);
      wingRoot.add(spar2, feather1, feather2);
    };
    buildDragonWingBones(leftWing, -1);
    buildDragonWingBones(rightWing, 1);
  }

  // ===========================================================================
  // 4. KNIGHT SEBY ('n'): 4-LEGGED WARHORSE SKELETON HIERARCHY
  // ===========================================================================
  const baseHorseY = baseY + bodySpan * 0.34;
  const horseChest = createPivotJoint(THREE, 'horseChest', 0, baseHorseY, 0);
  const horseHead = createPivotJoint(THREE, 'horseHead', 0, 0.06, 0.17);
  const frontLeftLeg = createPivotJoint(THREE, 'frontLeftLeg', -0.105, 0, 0.15);
  const frontRightLeg = createPivotJoint(THREE, 'frontRightLeg', 0.105, 0, 0.15);
  const hindLeftLeg = createPivotJoint(THREE, 'hindLeftLeg', -0.105, 0, -0.15);
  const hindRightLeg = createPivotJoint(THREE, 'hindRightLeg', 0.105, 0, -0.15);

  let frontLeftKnee = null;
  let frontRightKnee = null;
  let hindLeftKnee = null;
  let hindRightKnee = null;
  const hoofRings = [];

  if (isKnight) {
    rig.add(horseChest);
    horseChest.add(horseHead, frontLeftLeg, frontRightLeg, hindLeftLeg, hindRightLeg);

    // Horse spine from croup (-0.17m) to chest (+0.17m)
    horseChest.add(createBoneSegmentMesh(THREE, 0, 0, 0.34, 0.025, 0.022, secondaryBoneMat));
    addJointSphere(horseChest, 0, 0, 0.16, 1.1);
    addJointSphere(horseChest, 0, 0, -0.16, 1.05);

    // Horse neck + skull + snout pointing forward (+Z)
    horseHead.add(createBoneSegmentMesh(THREE, 0, 0.18, 0.10, 0.022, 0.018, secondaryBoneMat));
    addJointSphere(horseHead, 0, 0.18, 0.10, 1.15);
    const snoutBone = createBoneSegmentMesh(THREE, 0, -0.04, 0.14, 0.018, 0.012, boneMat);
    snoutBone.position.set(0, 0.18, 0.10);
    horseHead.add(snoutBone);

    const horseLegLen = Math.max(0.20, baseHorseY - baseY - 0.015);
    const upperHorseLeg = horseLegLen * 0.52;
    const lowerHorseLeg = horseLegLen * 0.48;

    const buildHorseLeg = (legRoot, kneeName) => {
      addJointSphere(legRoot, 0, 0, 0, 0.92);
      legRoot.add(createBoneSegmentMesh(THREE, 0, -upperHorseLeg, 0, 0.02, 0.016, secondaryBoneMat));
      const knee = createPivotJoint(THREE, kneeName, 0, -upperHorseLeg, 0);
      addJointSphere(knee, 0, 0, 0, 0.82);
      knee.add(createBoneSegmentMesh(THREE, 0, -lowerHorseLeg, 0, 0.016, 0.014, boneMat));
      addJointSphere(knee, 0, -lowerHorseLeg, 0, 0.78);

      const hoofRing = new THREE.Mesh(new THREE.RingGeometry(0.032, 0.064, 14), footprintMat);
      hoofRing.rotation.x = -Math.PI * 0.5;
      hoofRing.position.set(0, -lowerHorseLeg - 0.01, 0.015);
      hoofRing.renderOrder = 15;
      knee.add(hoofRing);
      hoofRings.push(hoofRing);

      legRoot.add(knee);
      return knee;
    };

    frontLeftKnee = buildHorseLeg(frontLeftLeg, 'frontLeftKnee');
    frontRightKnee = buildHorseLeg(frontRightLeg, 'frontRightKnee');
    hindLeftKnee = buildHorseLeg(hindLeftLeg, 'hindLeftKnee');
    hindRightKnee = buildHorseLeg(hindRightLeg, 'hindRightKnee');
  } else {
    // Attach dormant horse pivot nodes under pelvis so joint queries are always safe across all ranks
    pelvis.add(horseChest);
    horseChest.add(horseHead, frontLeftLeg, frontRightLeg, hindLeftLeg, hindRightLeg);
  }

  // Expose joints both as direct properties on `rig` and in `rig.joints` / `rig.userData`
  const joints = {
    pelvis,
    spine,
    head,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
    leftWing,
    rightWing,
    horseChest,
    horseHead,
    frontLeftLeg,
    frontRightLeg,
    hindLeftLeg,
    hindRightLeg,
    frontLeftKnee,
    frontRightKnee,
    hindLeftKnee,
    hindRightKnee,
  };

  Object.assign(rig, joints);
  rig.joints = joints;
  rig.bones = Object.values(joints).filter(Boolean);
  rig.userData = {
    ...joints,
    joints,
    pieceType: type,
    pieceHeight: totalHeight,
    color,
    basePelvisY,
    basePelvisZ,
    baseHorseY,
    boneMat,
    secondaryBoneMat,
    jointMat,
    footprintMat,
    leftFootRing: leftLegParts.footRing,
    rightFootRing: rightLegParts.footRing,
    hoofRings,
    skullSphere,
    alwaysVisible: false,
    holographicOpacity: 0,
  };

  // Start hidden unless global skeletons toggle is active or piece starts moving
  rig.visible = false;
  return rig;
}

/**
 * Updates the 3D joint rotations and holographic visibility of an articulated skeleton rig.
 *
 * @param {import('three').Group & Record<string, any>} rig
 * @param {string} [pieceType='p']
 * @param {object} [pose]
 * @param {number} [pose.walkPhase=0]
 * @param {number} [pose.walkAmp=0]
 * @param {number} [pose.combatPhase=0]
 * @param {number} [pose.combatAmp=0]
 * @param {number} [pose.rearUp=0]
 * @param {number} [pose.pitchX=0]
 * @param {boolean} [pose.skeletonsVisible]
 */
export function updateSkeletonRigPose(rig, pieceType = 'p', pose = {}) {
  if (!rig || !rig.userData) return;

  const u = rig.userData;
  const type = String(pieceType || u.pieceType || 'p').toLowerCase();
  const walkPhase = Number(pose.walkPhase) || 0;
  const walkAmp = Number(pose.walkAmp) || 0;
  const combatPhase = Number(pose.combatPhase) || 0;
  const combatAmp = Number(pose.combatAmp) || 0;
  const pitchX = Number(pose.pitchX) || 0;
  const rearUp = Math.max(
    Number(pose.rearUp) || 0,
    type === 'n' && pitchX < -0.12 ? Math.min(1, -pitchX * 1.9) : 0,
  );

  const alwaysVis =
    typeof pose.skeletonsVisible === 'boolean' ? pose.skeletonsVisible : Boolean(u.alwaysVisible);
  const isMovingOrFighting = walkAmp > 0.02 || combatAmp > 0.04 || rearUp > 0.02;

  if (alwaysVis) {
    rig.visible = true;
    const pulse = 0.88 + 0.10 * Math.sin(walkPhase * 2 + combatPhase);
    if (u.boneMat) u.boneMat.opacity = pulse;
    if (u.secondaryBoneMat) u.secondaryBoneMat.opacity = pulse;
    if (u.jointMat) u.jointMat.opacity = 0.98;
    if (u.footprintMat) u.footprintMat.opacity = isMovingOrFighting ? 0.90 : 0.55;
    u.holographicOpacity = pulse;
  } else if (isMovingOrFighting) {
    // Automatically pulse at ~35%..52% holographic opacity while walking, galloping, or brawling!
    rig.visible = true;
    const holoOpacity = 0.35 + 0.16 * Math.abs(Math.sin(walkPhase * 1.5 + combatPhase));
    if (u.boneMat) u.boneMat.opacity = holoOpacity;
    if (u.secondaryBoneMat) u.secondaryBoneMat.opacity = holoOpacity + 0.06;
    if (u.jointMat) u.jointMat.opacity = Math.min(0.95, holoOpacity + 0.22);
    if (u.footprintMat) u.footprintMat.opacity = Math.min(0.92, holoOpacity + 0.25);
    u.holographicOpacity = holoOpacity;
  } else {
    rig.visible = false;
    u.holographicOpacity = 0;
  }

  // Even when skeletonsVisible is toggled on at rest, provide a subtle ready-stance articulation
  const idleBreath = alwaysVis && !isMovingOrFighting ? 0.12 : 0;
  const effWalkAmp = Math.max(walkAmp, idleBreath);
  const effPhase = isMovingOrFighting ? walkPhase : (pose.idlePhase ?? 0.65);

  const strideSin = Math.sin(effPhase);
  const strideCos = Math.cos(effPhase);
  const stride = strideSin * Math.min(1.6, effWalkAmp);

  // 1. Pelvis bounce, sway & twist
  if (u.pelvis) {
    u.pelvis.position.y =
      u.basePelvisY + Math.abs(strideSin) * 0.042 * effWalkAmp + rearUp * 0.14;
    u.pelvis.rotation.y = strideSin * 0.16 * effWalkAmp;
    u.pelvis.rotation.z = strideCos * 0.08 * effWalkAmp;
    u.pelvis.rotation.x = type === 'n' ? -rearUp * 0.32 : 0;
  }

  // 2. Biped / Rider Legs & Knees
  if (type === 'n') {
    // Rider legs grip the warhorse saddle & bounce in the stirrups
    if (u.leftLeg) {
      u.leftLeg.rotation.x = -0.34 + strideSin * 0.26 * effWalkAmp;
      u.leftLeg.rotation.z = -0.26;
    }
    if (u.rightLeg) {
      u.rightLeg.rotation.x = -0.34 - strideSin * 0.26 * effWalkAmp;
      u.rightLeg.rotation.z = 0.26;
    }
    if (u.leftKnee) u.leftKnee.rotation.x = 0.52 + Math.max(0, strideCos) * 0.25 * effWalkAmp;
    if (u.rightKnee) u.rightKnee.rotation.x = 0.52 + Math.max(0, -strideCos) * 0.25 * effWalkAmp;
  } else {
    // Biped alternating walk/march stride (Pawn Puffin, Riccardo, Kate, Ale, Pupurabbu)
    if (u.leftLeg) {
      u.leftLeg.rotation.x = stride * 0.72;
      u.leftLeg.rotation.z = strideCos * 0.07 * effWalkAmp;
    }
    if (u.rightLeg) {
      u.rightLeg.rotation.x = -stride * 0.72;
      u.rightLeg.rotation.z = -strideCos * 0.07 * effWalkAmp;
    }
    if (u.leftKnee) {
      u.leftKnee.rotation.x = -Math.max(0.05, strideCos) * 0.62 * effWalkAmp;
    }
    if (u.rightKnee) {
      u.rightKnee.rotation.x = -Math.max(0.05, -strideCos) * 0.62 * effWalkAmp;
    }
    // Pulse footstep rings as each foot strikes the ground
    if (u.leftFootRing) {
      const lContact = Math.max(0.3, -strideCos);
      u.leftFootRing.scale.setScalar(0.85 + lContact * 0.55 * effWalkAmp);
    }
    if (u.rightFootRing) {
      const rContact = Math.max(0.3, strideCos);
      u.rightFootRing.scale.setScalar(0.85 + rContact * 0.55 * effWalkAmp);
    }
  }

  // 3. Spine, Head & Counter-Swinging Arms + Combat Weapon Slash
  const combatSlash = Math.sin(combatPhase) * combatAmp;
  const combatPunch = Math.cos(combatPhase * 1.5) * combatAmp;

  if (u.spine) {
    u.spine.rotation.y = -strideSin * 0.18 * effWalkAmp + combatSlash * 0.34;
    u.spine.rotation.x = 0.09 * effWalkAmp + Math.abs(combatSlash) * 0.22;
  }
  if (u.head) {
    u.head.rotation.y = strideSin * 0.10 * effWalkAmp - combatSlash * 0.18;
    u.head.rotation.x = strideCos * 0.07 * effWalkAmp - rearUp * 0.15;
  }

  const armSwing = -stride * 0.62;
  if (u.leftArm) {
    u.leftArm.rotation.x = armSwing + combatPunch * 0.65;
    u.leftArm.rotation.z = 0.16 + Math.abs(stride) * 0.10 + combatAmp * 0.24;
  }
  if (u.rightArm) {
    u.rightArm.rotation.x = -armSwing - combatSlash * 0.98;
    u.rightArm.rotation.z = -0.16 - Math.abs(stride) * 0.10 - combatAmp * 0.28;
  }
  if (u.leftElbow) {
    u.leftElbow.rotation.x = 0.20 + Math.max(0, armSwing) * 0.48 + combatAmp * 0.45;
  }
  if (u.rightElbow) {
    u.rightElbow.rotation.x = 0.24 + Math.max(0, -armSwing) * 0.48 + Math.abs(combatSlash) * 0.65;
  }

  // 4. Bishop Ale ('b') Dragon Wings
  if (u.leftWing && u.rightWing) {
    const wingDrive = Math.max(effWalkAmp, combatAmp);
    const wingFlap = Math.sin(effPhase * 1.2 + combatPhase) * wingDrive;
    u.leftWing.rotation.z = 0.24 + wingFlap * 0.72;
    u.rightWing.rotation.z = -0.24 - wingFlap * 0.72;
    u.leftWing.rotation.y = -0.14 + strideCos * 0.26 * wingDrive;
    u.rightWing.rotation.y = 0.14 - strideCos * 0.26 * wingDrive;
  }

  // 5. Knight Seby ('n') 4-Legged Warhorse Rear-Up & Rotary Gallop
  if (u.horseChest) {
    u.horseChest.position.y = u.baseHorseY + rearUp * 0.18 + Math.abs(strideSin) * 0.05 * effWalkAmp;
    u.horseChest.rotation.x = -rearUp * 0.58 + strideCos * 0.20 * effWalkAmp;
  }
  if (u.horseHead) {
    u.horseHead.rotation.x =
      rearUp * 0.38 + strideSin * 0.26 * effWalkAmp + combatSlash * 0.32;
    u.horseHead.rotation.y = strideCos * 0.10 * effWalkAmp;
  }

  // 4-beat rotary gallop phase offsets
  const flPhase = effPhase;
  const frPhase = effPhase + 0.75;
  const hlPhase = effPhase + Math.PI;
  const hrPhase = effPhase + Math.PI + 0.75;

  if (u.frontLeftLeg) {
    u.frontLeftLeg.rotation.x =
      -rearUp * 0.92 + Math.sin(flPhase) * 0.82 * effWalkAmp + combatSlash * 0.45;
  }
  if (u.frontRightLeg) {
    u.frontRightLeg.rotation.x =
      -rearUp * 0.92 + Math.sin(frPhase) * 0.82 * effWalkAmp - combatSlash * 0.45;
  }
  if (u.hindLeftLeg) {
    u.hindLeftLeg.rotation.x = rearUp * 0.46 + Math.sin(hlPhase) * 0.74 * effWalkAmp;
  }
  if (u.hindRightLeg) {
    u.hindRightLeg.rotation.x = rearUp * 0.46 + Math.sin(hrPhase) * 0.74 * effWalkAmp;
  }

  if (u.frontLeftKnee) {
    u.frontLeftKnee.rotation.x =
      rearUp * 0.75 + Math.max(0, Math.cos(flPhase)) * 0.72 * effWalkAmp;
  }
  if (u.frontRightKnee) {
    u.frontRightKnee.rotation.x =
      rearUp * 0.75 + Math.max(0, Math.cos(frPhase)) * 0.72 * effWalkAmp;
  }
  if (u.hindLeftKnee) {
    u.hindLeftKnee.rotation.x = -Math.max(0, Math.cos(hlPhase)) * 0.62 * effWalkAmp;
  }
  if (u.hindRightKnee) {
    u.hindRightKnee.rotation.x = -Math.max(0, Math.cos(hrPhase)) * 0.62 * effWalkAmp;
  }
}

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SeatMapResponse, SeatInfo } from '../api';
import { Eye, RotateCcw, ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface Props {
  seatMap: SeatMapResponse;
  selectedSeats: string[];
  fareClass: string;
  onSeatToggle: (seatNumber: string) => void;
}

interface HoveredSeatInfo {
  seat: SeatInfo;
  sectionName: string;
  isSelectable: boolean;
  screenX: number;
  screenY: number;
}

export function SeatMap3D({ seatMap, selectedSeats, fareClass, onSeatToggle }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredSeat, setHoveredSeat] = useState<HoveredSeatInfo | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Store seat meshes mapped by seat number for quick color updates
  const seatMeshesRef = useRef<Map<string, {
    mesh: THREE.Mesh;
    baseMaterial: THREE.Material;
    seat: SeatInfo;
    sectionName: string;
    isSelectable: boolean;
  }>>(new Map());

  // Re-usable materials
  const materialsRef = useRef<{
    selected: THREE.MeshStandardMaterial;
    availableEconomy: THREE.MeshStandardMaterial;
    availableBusiness: THREE.MeshStandardMaterial;
    availableFirst: THREE.MeshStandardMaterial;
    occupied: THREE.MeshStandardMaterial;
    locked: THREE.MeshStandardMaterial;
    disabled: THREE.MeshStandardMaterial;
    hovered: THREE.MeshStandardMaterial;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = 520;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120'); // Deep night sky
    scene.fog = new THREE.FogExp2('#0b1120', 0.015);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 14, 24);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const cabinCeilingLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    cabinCeilingLight.position.set(0, 15, 0);
    cabinCeilingLight.castShadow = true;
    cabinCeilingLight.shadow.mapSize.width = 1024;
    cabinCeilingLight.shadow.mapSize.height = 1024;
    scene.add(cabinCeilingLight);

    const warmAccentLight = new THREE.PointLight(0x38bdf8, 2, 20);
    warmAccentLight.position.set(0, 4, 10);
    scene.add(warmAccentLight);

    // Initialize Materials
    const materials = {
      selected: new THREE.MeshStandardMaterial({
        color: 0x10b981, // Vibrant emerald
        emissive: 0x059669,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.1,
      }),
      availableEconomy: new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Sky Blue
        roughness: 0.4,
        metalness: 0.1,
      }),
      availableBusiness: new THREE.MeshStandardMaterial({
        color: 0x1e3a8a, // Navy Luxury
        roughness: 0.25,
        metalness: 0.3,
      }),
      availableFirst: new THREE.MeshStandardMaterial({
        color: 0xd97706, // Amber/Gold Luxury
        emissive: 0x78350f,
        emissiveIntensity: 0.15,
        roughness: 0.2,
        metalness: 0.4,
      }),
      occupied: new THREE.MeshStandardMaterial({
        color: 0x334155, // Muted Slate
        roughness: 0.8,
        metalness: 0.1,
      }),
      locked: new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Warm Amber
        roughness: 0.5,
      }),
      disabled: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.9,
      }),
      hovered: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      }),
    };
    materialsRef.current = materials;

    // Collect all rows and seats
    let totalRows = 0;
    const allSeats: { seat: SeatInfo; sectionName: string; isSelectable: boolean }[] = [];
    seatMap.sections.forEach(section => {
      const isSelectable = section.name === fareClass;
      section.seats.forEach(seat => {
        allSeats.push({ seat, sectionName: section.name, isSelectable });
        if (seat.row > totalRows) totalRows = seat.row;
      });
    });

    const rowSpacing = 1.6;
    const cabinLength = Math.max(20, (totalRows + 2) * rowSpacing);
    const cabinWidth = 7.5;
    const zCenterOffset = (totalRows * rowSpacing) / 2;

    // Build Fuselage Shell (Curved interior walls)
    const shellGeometry = new THREE.CylinderGeometry(
      cabinWidth / 2 + 0.4,
      cabinWidth / 2 + 0.4,
      cabinLength + 4,
      32,
      1,
      true,
      0,
      Math.PI
    );
    const shellMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      side: THREE.BackSide,
      roughness: 0.7,
      metalness: 0.1,
    });
    const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
    shellMesh.rotation.x = Math.PI / 2;
    shellMesh.rotation.z = Math.PI / 2;
    shellMesh.position.set(0, 3, 0);
    scene.add(shellMesh);

    // Cabin Floor
    const floorGeometry = new THREE.PlaneGeometry(cabinWidth, cabinLength + 4);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Blue LED Aisle strip
    const aisleStripGeo = new THREE.PlaneGeometry(0.08, cabinLength + 4);
    const aisleStripMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const aisleLeftStrip = new THREE.Mesh(aisleStripGeo, aisleStripMat);
    aisleLeftStrip.rotation.x = -Math.PI / 2;
    aisleLeftStrip.position.set(-0.55, 0.01, 0);
    scene.add(aisleLeftStrip);

    const aisleRightStrip = new THREE.Mesh(aisleStripGeo, aisleStripMat);
    aisleRightStrip.rotation.x = -Math.PI / 2;
    aisleRightStrip.position.set(0.55, 0.01, 0);
    scene.add(aisleRightStrip);

    // Cockpit Bulkhead Wall (Front)
    const bulkheadFrontGeo = new THREE.BoxGeometry(cabinWidth, 6, 0.4);
    const bulkheadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const bulkheadFront = new THREE.Mesh(bulkheadFrontGeo, bulkheadMat);
    bulkheadFront.position.set(0, 3, -zCenterOffset - 1.5);
    scene.add(bulkheadFront);

    // SkyVoyage Front Sign
    const signGeo = new THREE.BoxGeometry(2.4, 0.6, 0.05);
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.6,
    });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 4.2, -zCenterOffset - 1.25);
    scene.add(signMesh);

    // Rear Wall
    const bulkheadBack = new THREE.Mesh(bulkheadFrontGeo, bulkheadMat);
    bulkheadBack.position.set(0, 3, zCenterOffset + 2);
    scene.add(bulkheadBack);

    // Procedural Seat Geometry Generator
    const seatGroup = new THREE.Group();
    const seatMapCache = new Map<string, {
      mesh: THREE.Mesh;
      baseMaterial: THREE.Material;
      seat: SeatInfo;
      sectionName: string;
      isSelectable: boolean;
    }>();

    // Reusable geometries
    const cushionGeo = new THREE.BoxGeometry(0.58, 0.16, 0.55);
    const backrestGeo = new THREE.BoxGeometry(0.56, 0.8, 0.12);
    const headrestGeo = new THREE.BoxGeometry(0.42, 0.25, 0.14);
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45);
    const armrestGeo = new THREE.BoxGeometry(0.08, 0.1, 0.5);

    const seatLetterCols: Record<string, number> = {
      'A': -2.3,
      'B': -1.6,
      'C': -0.9,
      // Aisle gap (x = 0)
      'D': 0.9,
      'E': 1.6,
      'F': 2.3,
    };

    allSeats.forEach(({ seat, sectionName, isSelectable }) => {
      const isSelected = selectedSeats.includes(seat.number);

      // Determine starting material
      let mat: THREE.MeshStandardMaterial = materials.disabled;
      if (isSelected) {
        mat = materials.selected;
      } else if (seat.status === 'booked') {
        mat = materials.occupied;
      } else if (seat.status === 'locked') {
        mat = materials.locked;
      } else if (!isSelectable) {
        mat = materials.disabled;
      } else if (sectionName === 'first') {
        mat = materials.availableFirst;
      } else if (sectionName === 'business') {
        mat = materials.availableBusiness;
      } else {
        mat = materials.availableEconomy;
      }

      // Root seat mesh is the cushion (for raycasting target)
      const seatMesh = new THREE.Mesh(cushionGeo, mat);
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;

      // Position based on row and letter
      const xPos = seatLetterCols[seat.letter] ?? (seat.letter.charCodeAt(0) - 67) * 0.7;
      const zPos = -zCenterOffset + seat.row * rowSpacing;
      seatMesh.position.set(xPos, 0.45, zPos);

      // Backrest
      const backrest = new THREE.Mesh(backrestGeo, mat);
      backrest.position.set(0, 0.42, -0.22);
      backrest.rotation.x = -0.12;
      seatMesh.add(backrest);

      // Headrest
      const headrest = new THREE.Mesh(headrestGeo, mat);
      headrest.position.set(0, 0.85, -0.27);
      seatMesh.add(headrest);

      // Armrests (left & right)
      const armLeft = new THREE.Mesh(armrestGeo, materials.occupied);
      armLeft.position.set(-0.31, 0.2, 0.02);
      seatMesh.add(armLeft);

      const armRight = new THREE.Mesh(armrestGeo, materials.occupied);
      armRight.position.set(0.31, 0.2, 0.02);
      seatMesh.add(armRight);

      // Support legs
      const legLeft = new THREE.Mesh(legGeo, materials.occupied);
      legLeft.position.set(-0.2, -0.22, 0);
      seatMesh.add(legLeft);

      const legRight = new THREE.Mesh(legGeo, materials.occupied);
      legRight.position.set(0.2, -0.22, 0);
      seatMesh.add(legRight);

      // Tag userData for raycasting
      seatMesh.userData = { seat, sectionName, isSelectable, number: seat.number };

      seatGroup.add(seatMesh);
      seatMapCache.set(seat.number, {
        mesh: seatMesh,
        baseMaterial: mat,
        seat,
        sectionName,
        isSelectable,
      });
    });

    scene.add(seatGroup);
    seatMeshesRef.current = seatMapCache;

    // Raycasting for interactive hover & click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(seatGroup.children, true);

      if (intersects.length > 0) {
        // Find top-level cushion mesh that holds userData
        let target: THREE.Object3D | null = intersects[0].object;
        while (target && !target.userData?.seat && target.parent) {
          target = target.parent;
        }

        if (target && target.userData?.seat) {
          const { seat, sectionName, isSelectable } = target.userData;
          renderer.domElement.style.cursor = isSelectable && seat.status === 'available' ? 'pointer' : 'default';
          setHoveredSeat({
            seat,
            sectionName,
            isSelectable,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
          });
          return;
        }
      }

      renderer.domElement.style.cursor = 'default';
      setHoveredSeat(null);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(seatGroup.children, true);

      if (intersects.length > 0) {
        let target: THREE.Object3D | null = intersects[0].object;
        while (target && !target.userData?.seat && target.parent) {
          target = target.parent;
        }

        if (target && target.userData?.seat) {
          const { seat, isSelectable } = target.userData;
          const isSelected = selectedSeats.includes(seat.number);
          if (isSelected || (isSelectable && seat.status === 'available')) {
            onSeatToggle(seat.number);
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [seatMap, fareClass]); // Rebuild when flight or seatMap changes

  // Update seat colors dynamically when selectedSeats changes without rebuilding the scene
  useEffect(() => {
    const materials = materialsRef.current;
    if (!materials) return;

    seatMeshesRef.current.forEach(({ mesh, seat, sectionName, isSelectable }) => {
      const isSelected = selectedSeats.includes(seat.number);
      let targetMaterial: THREE.MeshStandardMaterial;

      if (isSelected) {
        targetMaterial = materials.selected;
      } else if (seat.status === 'booked') {
        targetMaterial = materials.occupied;
      } else if (seat.status === 'locked') {
        targetMaterial = materials.locked;
      } else if (!isSelectable) {
        targetMaterial = materials.disabled;
      } else if (sectionName === 'first') {
        targetMaterial = materials.availableFirst;
      } else if (sectionName === 'business') {
        targetMaterial = materials.availableBusiness;
      } else {
        targetMaterial = materials.availableEconomy;
      }

      mesh.material = targetMaterial;
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh && child !== mesh) {
          // Keep armrests & legs dark
          if (child.geometry.type !== 'BoxGeometry' || child.position.x === 0) {
            child.material = targetMaterial;
          }
        }
      });
    });
  }, [selectedSeats]);

  // Camera preset buttons
  const setCameraPreset = (view: 'perspective' | 'top' | 'aisle') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (view === 'perspective') {
      camera.position.set(0, 14, 22);
      controls.target.set(0, 2, 0);
    } else if (view === 'top') {
      camera.position.set(0, 24, 0.1);
      controls.target.set(0, 0, 0);
    } else if (view === 'aisle') {
      camera.position.set(0, 2.2, 14);
      controls.target.set(0, 2, -10);
    }
    controls.update();
  };

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-gray-200)', background: '#0b1120' }}>
      {/* 3D Viewport Controls Bar */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 10,
        display: 'flex',
        gap: 'var(--space-2)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '6px 10px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <button
          onClick={() => setCameraPreset('perspective')}
          className="btn btn--sm"
          style={{ background: 'transparent', color: '#e2e8f0', border: 'none', padding: '4px 8px', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
          title="Perspective View"
        >
          <Compass size={14} /> Perspective
        </button>
        <button
          onClick={() => setCameraPreset('top')}
          className="btn btn--sm"
          style={{ background: 'transparent', color: '#e2e8f0', border: 'none', padding: '4px 8px', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
          title="Top Down Plan View"
        >
          <Eye size={14} /> Top-Down
        </button>
        <button
          onClick={() => setCameraPreset('aisle')}
          className="btn btn--sm"
          style={{ background: 'transparent', color: '#e2e8f0', border: 'none', padding: '4px 8px', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
          title="Aisle Walkthrough View"
        >
          <RotateCcw size={14} /> Walkthrough
        </button>
      </div>

      {/* Helper instruction */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 10,
        color: '#94a3b8',
        fontSize: 'var(--text-xs)',
        background: 'rgba(15, 23, 42, 0.75)',
        padding: '6px 12px',
        borderRadius: 'var(--radius-md)',
        pointerEvents: 'none',
      }}>
        🖱️ Click & Drag to Orbit • Scroll to Zoom • Click Seat to Select
      </div>

      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} style={{ width: '100%', height: 520 }} />

      {/* Interactive Tooltip HUD */}
      {hoveredSeat && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hoveredSeat.screenX + 12, (mountRef.current?.clientWidth || 700) - 200),
            top: Math.max(hoveredSeat.screenY - 80, 10),
            zIndex: 20,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            color: '#ffffff',
            pointerEvents: 'none',
            fontSize: 'var(--text-xs)',
            minWidth: 160,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#38bdf8' }}>
              Seat {hoveredSeat.seat.number}
            </span>
            <span style={{
              textTransform: 'uppercase',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: hoveredSeat.sectionName === 'first' ? '#d97706' : hoveredSeat.sectionName === 'business' ? '#2563eb' : '#0284c7',
              color: '#fff',
            }}>
              {hoveredSeat.sectionName}
            </span>
          </div>
          <div style={{ color: '#cbd5e1', marginBottom: 4, textTransform: 'capitalize' }}>
            {hoveredSeat.seat.type} Seat
          </div>
          <div style={{
            fontWeight: 600,
            color: selectedSeats.includes(hoveredSeat.seat.number) ? '#10b981' :
                   hoveredSeat.seat.status === 'booked' ? '#ef4444' :
                   hoveredSeat.seat.status === 'locked' ? '#f59e0b' :
                   !hoveredSeat.isSelectable ? '#64748b' : '#38bdf8',
          }}>
            {selectedSeats.includes(hoveredSeat.seat.number) ? '✓ Selected (Click to remove)' :
             hoveredSeat.seat.status === 'booked' ? 'Occupied' :
             hoveredSeat.seat.status === 'locked' ? 'Held by another passenger' :
             !hoveredSeat.isSelectable ? `Requires ${hoveredSeat.sectionName} fare` :
             'Click to Select Seat'}
          </div>
        </div>
      )}

      {/* 3D Seat Color Legend */}
      <div style={{
        padding: '12px 16px',
        background: '#0f172a',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-6)',
        flexWrap: 'wrap',
        fontSize: 'var(--text-xs)',
        color: '#94a3b8',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#0284c7' }} />
          <span>Economy ($)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#1e3a8a', border: '1px solid #3b82f6' }} />
          <span>Business ($$)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#d97706' }} />
          <span>First Class ($$$)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ color: '#10b981', fontWeight: 600 }}>Your Selection</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#334155' }} />
          <span>Occupied</span>
        </div>
      </div>
    </div>
  );
}

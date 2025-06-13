import * as THREE from 'three';
import { planeVertexShader, planeFragmentShader, sphereVertexShader, sphereFragmentShader } from './shaders';
import { RGBELoader } from './loaders/RGBELoader';

export interface GradientProps {
  colors?: [string, string, string];
  uTime?: number;
  uSpeed?: number;
  uDensity?: number;
  uStrength?: number;
  uFrequency?: number;
  uAmplitude?: number;
  type?: 'plane' | 'sphere';
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotationX?: number; // degrees
  rotationY?: number; // degrees
  rotationZ?: number; // degrees
  wireframe?: boolean;
  // ... other props from MeshT can be added here as needed
  lightType?: '3d' | 'env';
  brightness?: number;
  envPreset?: 'city' | 'dawn' | 'lobby';
  envHdrPath?: string; // Base path for HDR files, e.g., './hdr/'
}

export class Gradient {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshPhysicalMaterial | null = null;

  private canvas: HTMLCanvasElement;
  public props: GradientProps;

  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;

  private ambientLight: THREE.AmbientLight | null = null;
  private currentEnvMap: THREE.Texture | null = null;
  private rgbeLoader: RGBELoader | null = null;


  constructor(canvas: HTMLCanvasElement, props: GradientProps = {}) {
    this.canvas = canvas;
    this.props = { ...this.getDefaultProps(), ...props };

    this.rgbeLoader = new RGBELoader(new THREE.LoadingManager());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.canvas.width / this.canvas.height, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.init();
    this.animate = this.animate.bind(this);
    this.startAnimation();
  }

  private getDefaultProps(): GradientProps {
    return {
      colors: ['#ff0000', '#00ff00', '#0000ff'],
      uTime: 0,
      uSpeed: 0.3,
      uDensity: 1.0,
      uStrength: 0.2,
      uFrequency: 2.0,
      uAmplitude: 4.0,
      type: 'plane',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      wireframe: false,
      lightType: '3d',
      brightness: 1,
      envPreset: 'city',
      envHdrPath: './', // User will need to configure this
    };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : null;
  }

  private formatColorValue(value: number | undefined): number {
    return typeof value === 'number' ? value : 0;
  }

  private createMaterial(): THREE.MeshPhysicalMaterial {
    const p = this.props;
    const c1 = this.hexToRgb(p.colors![0]);
    const c2 = this.hexToRgb(p.colors![1]);
    const c3 = this.hexToRgb(p.colors![2]);

    const initialUniforms = {
      uTime: { value: p.uTime },
      uSpeed: { value: p.uSpeed },
      uDensity: { value: p.uDensity },
      uStrength: { value: p.uStrength },
      uFrequency: { value: p.uFrequency },
      uAmplitude: { value: p.uAmplitude },
      uC1r: { value: this.formatColorValue(c1?.r) },
      uC1g: { value: this.formatColorValue(c1?.g) },
      uC1b: { value: this.formatColorValue(c1?.b) },
      uC2r: { value: this.formatColorValue(c2?.r) },
      uC2g: { value: this.formatColorValue(c2?.g) },
      uC2b: { value: this.formatColorValue(c2?.b) },
      uC3r: { value: this.formatColorValue(c3?.r) },
      uC3g: { value: this.formatColorValue(c3?.g) },
      uC3b: { value: this.formatColorValue(c3?.b) },
      uLoadingTime: { value: 1.0 },
      uIntensity: { value: 0.5 },
    };

    const material = new THREE.MeshPhysicalMaterial({
      metalness: 0.2,
      side: THREE.DoubleSide,
      wireframe: !!p.wireframe,
      userData: { uniforms: initialUniforms }
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms = {
        ...shader.uniforms,
        ...initialUniforms
      };
      if (this.props.type === 'sphere') {
        shader.vertexShader = sphereVertexShader;
        shader.fragmentShader = sphereFragmentShader;
      } else { // 'plane'
        shader.vertexShader = planeVertexShader;
        shader.fragmentShader = planeFragmentShader;
      }
      material.userData.shader = shader;
    };

    return material;
  }

  private init(): void {
    this.camera.position.set(this.props.positionX!, this.props.positionY!, this.props.positionZ! + 5);

    this.material = this.createMaterial();

    let geometry: THREE.BufferGeometry;
    if (this.props.type === 'sphere') {
      geometry = new THREE.SphereGeometry(2, 32, 32);
    } else {
      // Added segments for potential displacement effects later
      geometry = new THREE.PlaneGeometry(5, 5, 32, 32);
    }

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(this.props.positionX!, this.props.positionY!, this.props.positionZ!);
    this.mesh.rotation.set(
      THREE.MathUtils.degToRad(this.props.rotationX!),
      THREE.MathUtils.degToRad(this.props.rotationY!),
      THREE.MathUtils.degToRad(this.props.rotationZ!)
    );

    this.scene.add(this.mesh);
    this.setupLighting();
  }

  private setupLighting(): void {
    // Clear existing lighting
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      // this.ambientLight.dispose(); // AmbientLight doesn't have dispose
      this.ambientLight = null;
    }
    if (this.currentEnvMap) {
      this.scene.environment = null;
      this.currentEnvMap.dispose();
      this.currentEnvMap = null;
    }

    const { lightType, brightness, envPreset, envHdrPath } = this.props;

    if (lightType === '3d') {
      this.ambientLight = new THREE.AmbientLight(0xffffff, (brightness || 1) * Math.PI);
      this.scene.add(this.ambientLight);
    } else if (lightType === 'env' && this.rgbeLoader) {
      const hdrFile = `${envPreset}.hdr`; // e.g., city.hdr
      const fullPath = `${envHdrPath || ''}${hdrFile}`; // Allow envHdrPath to be empty

      this.rgbeLoader.load(
        fullPath,
        (texture: THREE.DataTexture) => { // three.js type for RGBELoader is DataTexture
          texture.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.environment = texture;
          this.currentEnvMap = texture;
          // No need to call render here if animation loop is running
        },
        undefined, // onProgress callback (optional)
        (error: any) => {
          console.error(`Error loading HDR environment map "${fullPath}":`, error);
        }
      );
    }
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public startAnimation(): void {
    if (!this.animationFrameId) {
        this.lastFrameTime = performance.now();
        // Call animate directly to ensure it's part of the instance context
        this.animate();
    }
  }

  public stopAnimation(): void {
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }
  }

  // Make sure animate is bound or defined as an arrow function for requestAnimationFrame
  private animate(currentTime?: number): void {
    if (currentTime === undefined) {
        currentTime = performance.now();
    }

    const deltaTime = (currentTime - this.lastFrameTime) * 0.001;
    this.lastFrameTime = currentTime;

    if (this.material && (this.material.userData.shader || this.material.userData.uniforms)) {
        const shaderUniforms = this.material.userData.shader?.uniforms || this.material.userData.uniforms;
        if(shaderUniforms.uTime) {
             shaderUniforms.uTime.value += deltaTime * (this.props.uSpeed || 0);
        }
        this.props.uTime = shaderUniforms.uTime?.value; // Keep internal prop in sync
    }

    this.render();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  public updateProps(newProps: Partial<GradientProps>): void {
    const oldType = this.props.type;
    const oldRotX = this.props.rotationX;
    const oldRotY = this.props.rotationY;
    const oldRotZ = this.props.rotationZ;

    this.props = { ...this.props, ...newProps };

    if (this.mesh) {
        if (newProps.positionX !== undefined || newProps.positionY !== undefined || newProps.positionZ !== undefined) {
            this.mesh.position.set(this.props.positionX!, this.props.positionY!, this.props.positionZ!);
        }
        if (newProps.rotationX !== oldRotX || newProps.rotationY !== oldRotY || newProps.rotationZ !== oldRotZ) {
            this.mesh.rotation.set(
                THREE.MathUtils.degToRad(this.props.rotationX!),
                THREE.MathUtils.degToRad(this.props.rotationY!),
                THREE.MathUtils.degToRad(this.props.rotationZ!)
            );
        }

        if (newProps.type && newProps.type !== oldType) {
            let newGeometry: THREE.BufferGeometry;
            if (this.props.type === 'sphere') {
                newGeometry = new THREE.SphereGeometry(2, 32, 32);
            } else {
                newGeometry = new THREE.PlaneGeometry(5, 5, 32, 32);
            }
            this.mesh.geometry.dispose();
            this.mesh.geometry = newGeometry;
        }
    }

    if (this.material) {
      if (newProps.wireframe !== undefined) {
        this.material.wireframe = !!this.props.wireframe;
      }
      const shaderUniforms = this.material.userData.shader?.uniforms || this.material.userData.uniforms;

      if (shaderUniforms) {
        if (newProps.colors && this.props.colors) {
          const c1 = this.hexToRgb(this.props.colors[0]);
          const c2 = this.hexToRgb(this.props.colors[1]);
          const c3 = this.hexToRgb(this.props.colors[2]);
          if(shaderUniforms.uC1r) shaderUniforms.uC1r.value = this.formatColorValue(c1?.r);
          if(shaderUniforms.uC1g) shaderUniforms.uC1g.value = this.formatColorValue(c1?.g);
          if(shaderUniforms.uC1b) shaderUniforms.uC1b.value = this.formatColorValue(c1?.b);
          if(shaderUniforms.uC2r) shaderUniforms.uC2r.value = this.formatColorValue(c2?.r);
          if(shaderUniforms.uC2g) shaderUniforms.uC2g.value = this.formatColorValue(c2?.g);
          if(shaderUniforms.uC2b) shaderUniforms.uC2b.value = this.formatColorValue(c2?.b);
          if(shaderUniforms.uC3r) shaderUniforms.uC3r.value = this.formatColorValue(c3?.r);
          if(shaderUniforms.uC3g) shaderUniforms.uC3g.value = this.formatColorValue(c3?.g);
          if(shaderUniforms.uC3b) shaderUniforms.uC3b.value = this.formatColorValue(c3?.b);
        }
        if (newProps.uSpeed !== undefined && shaderUniforms.uSpeed) shaderUniforms.uSpeed.value = newProps.uSpeed;
        if (newProps.uDensity !== undefined && shaderUniforms.uDensity) shaderUniforms.uDensity.value = newProps.uDensity;
        if (newProps.uStrength !== undefined && shaderUniforms.uStrength) shaderUniforms.uStrength.value = newProps.uStrength;
        if (newProps.uFrequency !== undefined && shaderUniforms.uFrequency) shaderUniforms.uFrequency.value = newProps.uFrequency;
        if (newProps.uAmplitude !== undefined && shaderUniforms.uAmplitude) shaderUniforms.uAmplitude.value = newProps.uAmplitude;
      }
    }

    if (
      newProps.lightType !== undefined ||
      newProps.brightness !== undefined ||
      newProps.envPreset !== undefined ||
      newProps.envHdrPath !== undefined
    ) {
      this.setupLighting();
    }
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
  }

  public dispose(): void {
    this.stopAnimation();
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      // this.ambientLight.dispose(); // AmbientLight doesn't have dispose
      this.ambientLight = null;
    }
    if (this.currentEnvMap) {
      this.scene.environment = null;
      this.currentEnvMap.dispose();
      this.currentEnvMap = null;
    }
    if (this.mesh) {
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) {
            // Material is MeshPhysicalMaterial | null, so check it
            const material = this.mesh.material as THREE.MeshPhysicalMaterial;
            if (material.dispose) material.dispose();
        }
        // Remove mesh from scene if it's added
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
    }
    this.mesh = null;
    this.material = null; // Already disposed if it was part of the mesh

    // Dispose of other scene children if any were added besides the main mesh
    // this.scene.traverse(object => { ... }); // This might be too broad if not careful

    if (this.renderer) {
        this.renderer.dispose();
        // If you created the canvas, you might want to remove it from DOM too
        // this.canvas.remove();
    }
  }
}

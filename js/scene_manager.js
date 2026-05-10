import * as THREE from 'three';

export class SceneManager {
    constructor(threeContext) {
        this.ctx = threeContext;
        this.currentSceneInstance = null;
    }

    async loadScene(path) {
        console.log(`[SceneManager] Attempting to load: ${path}`);
        
        this.disposeCurrent();

        try {
            // Remove ?v= to allow Vite to resolve bare imports natively.
            // Vite already provides Hot Module Replacement automatically.
            const module = await import(path);
            if (module.default) {
                this.currentSceneInstance = new module.default(this.ctx);
                console.log(`[SceneManager] Scene initialized: ${path}`);
            } else {
                console.error(`[SceneManager] ${path} does not have a default export.`);
            }
        } catch (error) {
            console.error(`[SceneManager] Failed to import scene:`, error);
        }
    }

    update(data) {
        if (this.currentSceneInstance && this.currentSceneInstance.update) {
            this.currentSceneInstance.update(data);
        }
    }

    disposeCurrent() {
        if (this.currentSceneInstance) {
            console.log("[SceneManager] Disposing current scene instance...");
            if (this.currentSceneInstance.dispose) {
                this.currentSceneInstance.dispose();
            }
            this.currentSceneInstance = null;
        }
    }
}

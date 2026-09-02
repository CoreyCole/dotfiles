import type { FastConfig, FastConfigRepository } from "./fast-config-store.ts";
import { createFastWarningCollector, type FastWarning } from "./fast-warnings.ts";

export interface FastConfigLoadResult {
  config: FastConfig;
  warnings: readonly FastWarning[];
}

export class ConfigLoadCoordinator {
  private currentConfig: FastConfig;
  private loaded = false;
  private inFlightLoad: Promise<FastConfigLoadResult> | undefined;
  private readonly configStore: Pick<FastConfigRepository, "load">;

  constructor(initialConfig: FastConfig, configStore: Pick<FastConfigRepository, "load">) {
    this.currentConfig = initialConfig;
    this.configStore = configStore;
  }

  get current(): FastConfig {
    return this.currentConfig;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(cwd: string): Promise<FastConfigLoadResult> {
    if (this.loaded) {
      return { config: this.currentConfig, warnings: [] };
    }

    this.inFlightLoad ??= this.startLoad(cwd);
    return await this.inFlightLoad;
  }

  updateCurrent(config: FastConfig): void {
    this.currentConfig = config;
    this.loaded = true;
  }

  private async startLoad(cwd: string): Promise<FastConfigLoadResult> {
    const warningCollector = createFastWarningCollector();

    try {
      const config = await this.configStore.load(cwd, { warn: warningCollector.collect });
      this.updateCurrent(config);
      return { config, warnings: [...warningCollector.warnings] };
    } finally {
      this.inFlightLoad = undefined;
    }
  }
}

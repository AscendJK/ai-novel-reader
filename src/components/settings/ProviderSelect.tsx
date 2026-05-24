import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAPIStore } from "@/stores/api-store";
import { PROVIDER_PRESETS } from "@/api/registry";
import type { ProviderType } from "@/api/types";

export function ProviderSelect() {
  const { providers, activeProviderId, setActiveProvider } = useAPIStore();

  return (
    <Select
      value={activeProviderId || undefined}
      onValueChange={(v) => setActiveProvider(v as ProviderType)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="选择 API 提供商" />
      </SelectTrigger>
      <SelectContent>
        {PROVIDER_PRESETS.map((preset) => {
          const configured = providers.find((p) => p.type === preset.type);
          return (
            <SelectItem key={preset.type} value={preset.type}>
              <div className="flex items-center gap-2">
                <span>{preset.name}</span>
                {configured && (
                  <span className="text-xs text-muted-foreground">
                    ({configured.model})
                  </span>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

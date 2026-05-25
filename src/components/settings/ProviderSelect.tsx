import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAPIStore } from "@/stores/api-store";
import type { ProviderType } from "@/api/types";
import { COMPAT_PREFIX } from "@/api/types";

export function ProviderSelect() {
  const { providers, activeProviderId, setActiveProvider } = useAPIStore();
  const configured = providers.filter((p) => p.apiKey);

  return (
    <Select
      value={activeProviderId || undefined}
      onValueChange={(v) => setActiveProvider(v as ProviderType)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="选择 API 提供商" />
      </SelectTrigger>
      <SelectContent>
        {configured.map((p) => {
          const isCompat = p.type.startsWith(COMPAT_PREFIX);
          const label = isCompat ? (p.name || "OpenAI 格式接口") : p.name;
          return (
            <SelectItem key={p.type} value={p.type}>
              <div className="flex items-center gap-2">
                <span>{label}</span>
                <span className="text-xs text-muted-foreground">({p.model})</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

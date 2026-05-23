import { useState } from "react";
import { useAPIStore } from "@/stores/api-store";
import { PROVIDER_PRESETS } from "@/api/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProviderSelect } from "./ProviderSelect";
import type { ProviderType, ProviderConfig } from "@/api/types";
import { Key, Trash2, ArrowLeft } from "lucide-react";

const MODEL_OPTIONS: Record<ProviderType, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-7"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  "openai-compat": [],
};

export function ApiSettings({ onBack }: { onBack?: () => void }) {
  const { providers, addProvider, removeProvider, activeProviderId } = useAPIStore();
  const [editingType, setEditingType] = useState<ProviderType | null>(null);
  const [formData, setFormData] = useState({
    apiKey: "",
    baseUrl: "",
    model: "",
  });

  const handleEdit = (type: ProviderType) => {
    const existing = providers.find((p) => p.type === type);
    const preset = PROVIDER_PRESETS.find((p) => p.type === type)!;

    setEditingType(type);
    setFormData({
      apiKey: existing?.apiKey || "",
      baseUrl: existing?.baseUrl || preset.baseUrl,
      model: existing?.model || preset.defaultModel,
    });
  };

  const handleSave = () => {
    if (!editingType || !formData.apiKey) return;

    const preset = PROVIDER_PRESETS.find((p) => p.type === editingType)!;
    const config: ProviderConfig = {
      type: editingType,
      name: preset.name,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl || preset.baseUrl,
      model: formData.model || preset.defaultModel,
    };

    addProvider(config);
    setEditingType(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {onBack && (
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          返回
        </Button>
      )}
      <div>
        <h2 className="text-2xl font-semibold">API 设置</h2>
        <p className="text-sm text-muted-foreground mt-1">
          配置大模型 API，你的 API Key 仅存储在浏览器本地，不会上传到任何第三方服务器。
        </p>
      </div>

      {/* Active Provider Selector */}
      {providers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">当前使用的 API</CardTitle>
          </CardHeader>
          <CardContent>
            <ProviderSelect />
          </CardContent>
        </Card>
      )}

      {/* Provider List */}
      <div className="space-y-4">
        <h3 className="font-medium">已配置的提供商</h3>

        {PROVIDER_PRESETS.map((preset) => {
          const configured = providers.find((p) => p.type === preset.type);
          const isEditing = editingType === preset.type;

          if (isEditing) {
            return (
              <Card key={preset.type} className="border-primary">
                <CardHeader>
                  <CardTitle className="text-base">{preset.name}</CardTitle>
                  <CardDescription>API 地址: {formData.baseUrl || preset.baseUrl}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={formData.apiKey}
                      onChange={(e) => setFormData((d) => ({ ...d, apiKey: e.target.value }))}
                    />
                  </div>

                  {preset.type !== "openai-compat" && (
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <Select
                        value={formData.model}
                        onValueChange={(v) => setFormData((d) => ({ ...d, model: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_OPTIONS[preset.type]?.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {preset.type === "openai-compat" && (
                    <>
                      <div className="space-y-2">
                        <Label>API 地址 (Base URL)</Label>
                        <Input
                          placeholder="https://api.example.com/v1"
                          value={formData.baseUrl}
                          onChange={(e) => setFormData((d) => ({ ...d, baseUrl: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>模型名称</Label>
                        <Input
                          placeholder="gpt-4o / deepseek-chat / ..."
                          value={formData.model}
                          onChange={(e) => setFormData((d) => ({ ...d, model: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={!formData.apiKey}>
                      保存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingType(null)}>
                      取消
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card
              key={preset.type}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                activeProviderId === preset.type ? "border-primary" : ""
              }`}
              onClick={() => handleEdit(preset.type)}
            >
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {configured ? `已配置 · ${configured.model}` : "未配置"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {configured && (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {configured.model}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProvider(preset.type);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {!configured && (
                    <Button variant="outline" size="sm">
                      配置
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      <div className="text-xs text-muted-foreground space-y-1">
        <p>你的 API Key 仅存储在浏览器 IndexedDB 中，仅在调用对应 API 时使用。</p>
        <p>所有 API 调用直接从浏览器发起，不经过任何第三方服务器。</p>
      </div>
    </div>
  );
}

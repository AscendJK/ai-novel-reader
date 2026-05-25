import { useState } from "react";
import { useAPIStore } from "@/stores/api-store";
import { PROVIDER_PRESETS } from "@/api/registry";
import { COMPAT_PREFIX } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProviderSelect } from "./ProviderSelect";
import type { ProviderType, ProviderConfig } from "@/api/types";
import { Key, Trash2, ArrowLeft, AlertTriangle, Plus } from "lucide-react";
import { db } from "@/db/database";
import { RAGSettings } from "./RAGSettings";

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-7"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
};

export function ApiSettings({ onBack }: { onBack?: () => void }) {
  const { providers, addProvider, removeProvider, activeProviderId } = useAPIStore();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [formData, setFormData] = useState({ apiKey: "", baseUrl: "", model: "", customName: "" });

  const isCompat = (t: string) => t.startsWith("openai-compat-");
  const compatProviders = providers.filter((p) => isCompat(p.type));
  const fixedProviders = providers.filter((p) => !isCompat(p.type));

  const handleEdit = (type: string) => {
    const existing = providers.find((p) => p.type === type);
    let preset = PROVIDER_PRESETS.find((p) => p.type === type);
    if (!preset && isCompat(type)) {
      preset = { type: type as any, name: "", baseUrl: "", defaultModel: "" };
    }
    if (!preset) return;

    const idx = isCompat(type) ? parseInt(type.replace(COMPAT_PREFIX, ""), 10) + 1 : 0;
    setEditingType(type);
    setFormData({
      apiKey: existing?.apiKey || "",
      baseUrl: existing?.baseUrl || preset.baseUrl,
      model: existing?.model || preset.defaultModel,
      customName: (existing?.name && !existing.name.startsWith("OpenAI 格式接口")) ? existing.name : "",
    });
  };

  const handleSave = () => {
    if (!editingType || !formData.apiKey) return;

    let name: string;
    let preset = PROVIDER_PRESETS.find((p) => p.type === editingType);
    if (preset) {
      name = preset.name;
    } else if (isCompat(editingType)) {
      const defIdx = parseInt(editingType.replace(COMPAT_PREFIX, ""), 10) + 1;
      name = formData.customName.trim() || `OpenAI 格式接口 ${defIdx}`;
    } else {
      return;
    }

    const config: ProviderConfig = {
      type: editingType as ProviderType,
      name,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      model: formData.model,
    };

    addProvider(config);
    setEditingType(null);
  };

  const handleAddCompat = () => {
    // Find next unused compat index
    const used = new Set(compatProviders.map((p) => parseInt(p.type.replace(COMPAT_PREFIX, ""), 10)));
    let idx = 0;
    while (used.has(idx)) idx++;
    if (idx >= 5) return;
    const type = `${COMPAT_PREFIX}${idx}` as ProviderType;
    addProvider({
      type,
      name: `OpenAI 格式接口 ${idx + 1}`,
      apiKey: "",
      baseUrl: "",
      model: "",
    });
  };

  const handleDeleteCompat = (type: string) => {
    removeProvider(type as ProviderType);
  };

  const renderEditCard = (type: string, isCompatProvider: boolean) => (
    <Card key={type} className="border-primary">
      <CardHeader>
        <CardTitle className="text-base">
          {(isCompatProvider && providers.find(p => p.type === type)?.name) || (isCompatProvider ? "OpenAI 格式接口" : PROVIDER_PRESETS.find((p) => p.type === type)?.name)}
        </CardTitle>
        <CardDescription>
          {isCompatProvider ? "" : `API 地址: ${formData.baseUrl || PROVIDER_PRESETS.find((p) => p.type === type)?.baseUrl}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input type="password" placeholder="sk-..." value={formData.apiKey}
            onChange={(e) => setFormData((d) => ({ ...d, apiKey: e.target.value }))} />
        </div>
        {!isCompatProvider && type !== "openai-compat-0" && (
          <div className="space-y-2">
            <Label>模型</Label>
            <Select value={formData.model} onValueChange={(v) => setFormData((d) => ({ ...d, model: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(MODEL_OPTIONS[type] || []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {(isCompatProvider || type === "openai-compat-0") && (
          <>
            <div className="space-y-2">
              <Label>厂商名称（可选）</Label>
              <Input placeholder={`OpenAI 格式接口 ${parseInt((editingType || "").replace(COMPAT_PREFIX, ""), 10) + 1}`} value={formData.customName}
                onChange={(e) => setFormData((d) => ({ ...d, customName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>API 地址 (Base URL)</Label>
              <Input placeholder="https://api.example.com/v1" value={formData.baseUrl}
                onChange={(e) => setFormData((d) => ({ ...d, baseUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input placeholder="gpt-4o / deepseek-chat / ..." value={formData.model}
                onChange={(e) => setFormData((d) => ({ ...d, model: e.target.value }))} />
            </div>
          </>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={!formData.apiKey}>保存</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingType(null)}>取消</Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCard = (type: string, isCompact: boolean) => {
    const configured = providers.find((p) => p.type === type);
    const name = isCompact
      ? (configured?.name || `OpenAI 格式接口 ${parseInt(type.replace(COMPAT_PREFIX, ""), 10) + 1}`)
      : PROVIDER_PRESETS.find((p) => p.type === type)?.name || type;

    return (
      <Card key={type}
        className={`cursor-pointer transition-colors hover:bg-accent/50 ${activeProviderId === type ? "border-primary" : ""}`}
        onClick={() => handleEdit(type)}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{name}</p>
              <p className="text-xs text-muted-foreground">
                {configured?.apiKey ? `已配置 · ${configured.model || "未设模型"}` : "未配置"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {configured?.apiKey && configured.model && (
              <Badge variant="outline" className="text-xs">{configured.model}</Badge>
            )}
            {!configured?.apiKey && (
              <Button variant="outline" size="sm">配置</Button>
            )}
            {isCompact && (
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); removeProvider(type as ProviderType); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {onBack && (
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> 返回
        </Button>
      )}
      <div>
        <h2 className="text-2xl font-semibold">API 设置</h2>
        <p className="text-sm text-muted-foreground mt-1">
          配置大模型 API，你的 API Key 仅存储在浏览器本地。
        </p>
      </div>

      {providers.filter((p) => p.apiKey).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">当前使用的 API</CardTitle></CardHeader>
          <CardContent><ProviderSelect /></CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-medium">已配置的提供商</h3>

        {/* Fixed providers: OpenAI, Anthropic, DeepSeek */}
        {PROVIDER_PRESETS.filter((p) => !isCompat(p.type)).map((preset) => {
          if (editingType === preset.type) return renderEditCard(preset.type, false);
          return renderCard(preset.type, false);
        })}

        {/* Compat providers */}
        {compatProviders.map((p) => {
          if (editingType === p.type) return renderEditCard(p.type, true);
          return renderCard(p.type, true);
        })}
      </div>

      {/* Add compat button */}
      {compatProviders.length < 5 && (
        <Button variant="outline" size="sm" onClick={handleAddCompat} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> 添加 OpenAI 格式接口 ({compatProviders.length}/5)
        </Button>
      )}

      <Separator />
      <RAGSettings />
      <Separator />

      <div className="text-xs text-muted-foreground space-y-1">
        <p>你的 API Key 仅存储在浏览器 IndexedDB 中，仅在调用对应 API 时使用。</p>
        <p>所有 API 调用直接从浏览器发起，不经过任何第三方服务器。</p>
      </div>

      <Separator />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> 清除所有本地数据
          </CardTitle>
          <CardDescription>
            删除当前浏览器中存储的所有小说、分析结果、笔记、API 配置和阅读进度。此操作不可恢复。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => {
            if (!window.confirm("确认清除所有本地数据？\n\n将删除：\n• 所有上传的小说\n• 所有 AI 分析结果\n• 所有笔记\n• API 配置\n• 阅读进度\n• 同步会话\n\n此操作不可恢复！")) return;
            db.delete().then(() => window.location.reload());
            localStorage.clear();
          }}>
            <Trash2 className="h-4 w-4 mr-2" /> 清除全部数据并刷新
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

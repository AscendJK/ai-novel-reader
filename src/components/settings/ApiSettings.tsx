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
import { ProviderSelect } from "./ProviderSelect";
import type { ProviderType, ProviderConfig } from "@/api/types";
import { Key, Trash2, ArrowLeft, AlertTriangle, Plus, WifiOff, Wifi, Keyboard } from "lucide-react";
import { db } from "@/db/database";
import { useUIStore } from "@/stores/ui-store";
import { RAGSettings } from "./RAGSettings";
import { ExportPanel } from "./ExportPanel";
import { ShortcutHelp } from "@/components/common/ShortcutHelp";

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-7"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
};

export function ApiSettings({ onBack }: { onBack?: () => void }) {
  const { providers, addProvider, removeProvider, activeProviderId } = useAPIStore();
  const { offlineMode, setOfflineMode } = useUIStore();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [formData, setFormData] = useState({ apiKey: "", baseUrl: "", model: "", customName: "" });
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

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
          <Input id="api-key" name="api-key" type="password" placeholder="sk-..." value={formData.apiKey}
            onChange={(e) => setFormData((d) => ({ ...d, apiKey: e.target.value }))} />
        </div>
        {!isCompatProvider && type !== "openai-compat-0" && (
          <div className="space-y-2">
            <Label>模型</Label>
            <Input id="model-fixed" name="model-fixed" placeholder="输入模型名称..." value={formData.model}
              onChange={(e) => setFormData((d) => ({ ...d, model: e.target.value }))}
              list={`model-suggest-${type}`} />
            <datalist id={`model-suggest-${type}`}>
              {(MODEL_OPTIONS[type] || []).map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
        )}
        {(isCompatProvider || type === "openai-compat-0") && (
          <>
            <div className="space-y-2">
              <Label>厂商名称（可选）</Label>
              <Input id="compat-name" name="compat-name" placeholder={`OpenAI 格式接口 ${parseInt((editingType || "").replace(COMPAT_PREFIX, ""), 10) + 1}`} value={formData.customName}
                onChange={(e) => setFormData((d) => ({ ...d, customName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>API 地址 (Base URL)</Label>
              <Input id="compat-baseurl" name="compat-baseurl" placeholder="https://api.example.com/v1" value={formData.baseUrl}
                onChange={(e) => setFormData((d) => ({ ...d, baseUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input id="compat-model" name="compat-model" placeholder="gpt-4o / deepseek-chat / ..." value={formData.model}
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

      {/* Keyboard shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> 键盘快捷键
          </CardTitle>
          <CardDescription>阅读时可用的快捷键</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            ["← / →", "上一章 / 下一章"],
            ["+ / −", "增大 / 减小字号"],
            ["i", "切换沉浸模式"],
            ["t", "切换主题"],
            ["Esc", "关闭弹窗"],
            ["Shift + ?", "显示快捷键帮助"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="px-2 py-0.5 text-xs rounded border bg-muted font-mono">{key}</kbd>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowShortcutHelp(true)}>
            查看全部快捷键
          </Button>
        </CardContent>
      </Card>

      {/* Offline mode */}
      <Card className={offlineMode ? "border-amber-500/50" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {offlineMode ? <WifiOff className="h-4 w-4 text-amber-500" /> : <Wifi className="h-4 w-4" />}
            离线模式
          </CardTitle>
          <CardDescription>
            {offlineMode
              ? "已开启。浏览器不会与服务器通信，数据仅保存在本地。"
              : "开启后浏览器停止与服务器同步，关闭浏览器再打开仍可使用本地数据。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant={offlineMode ? "outline" : "default"}
            size="sm"
            onClick={() => {
              if (!offlineMode && !window.confirm("开启离线模式后：\n\n• 服务器同步将停止\n• 嵌入引擎索引构建不可用\n• 关闭浏览器再打开仍可使用本地数据\n• 退出登录后需服务器在线才能重新登录\n\n确认开启？")) return;
              setOfflineMode(!offlineMode);
            }}
          >
            {offlineMode ? "关闭离线模式" : "开启离线模式"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="text-xs text-muted-foreground space-y-1">
        <p>你的 API Key 仅存储在浏览器 IndexedDB 中，仅在调用对应 API 时使用。</p>
        <p>所有 API 调用直接从浏览器发起，不经过任何第三方服务器。</p>
      </div>

      <Separator />

      <ExportPanel />

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
      {showShortcutHelp && (
        <ShortcutHelp
          shortcuts={[
            { key: "ArrowLeft", action: () => {}, description: "上一章" },
            { key: "ArrowRight", action: () => {}, description: "下一章" },
            { key: "+", action: () => {}, description: "增大字号" },
            { key: "-", action: () => {}, description: "减小字号" },
            { key: "i", action: () => {}, description: "切换沉浸模式" },
            { key: "t", action: () => {}, description: "切换主题" },
            { key: "Escape", action: () => {}, description: "关闭弹窗" },
            { key: "?", shift: true, action: () => {}, description: "显示快捷键帮助" },
          ]}
          onClose={() => setShowShortcutHelp(false)}
        />
      )}
    </div>
  );
}

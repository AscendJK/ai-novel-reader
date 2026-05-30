import { useState } from "react";
import { BookOpen, LogIn, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Props {
  localUsers: string[];
  onLogin: (username: string) => Promise<void>;
  onDelete: (username: string) => void;
  error?: string | null;
  syncing?: boolean;
}

export function UsernameLogin({ localUsers, onLogin, onDelete, error, syncing }: Props) {
  const [selectedUser, setSelectedUser] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const isNewUser = selectedUser === "__new__";
  const username = isNewUser ? newUsername.trim() : selectedUser;
  const canSubmit = username.length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try { await onLogin(username); }
    finally { setLoading(false); }
  };

  const handleDelete = () => {
    if (!selectedUser || selectedUser === "__new__") return;
    if (window.confirm(`确认删除用户 "${selectedUser}" 的所有本地数据？此操作不可恢复。`)) {
      onDelete(selectedUser);
      setSelectedUser("");
    }
  };

  if (syncing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="w-full max-w-sm mx-4">
          <CardContent className="py-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">正在同步云端数据...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="text-center">
          <BookOpen className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>AI 小说精读助手</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            选择已有用户或创建新用户
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User selector */}
          <div className="space-y-2">
            <select
              id="user-select" name="user-select"
              className="w-full text-sm border rounded px-3 py-2 bg-background"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">-- 选择用户 --</option>
              {localUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="__new__">+ 创建新用户</option>
            </select>
          </div>

          {/* New username input */}
          {isNewUser && (
            <Input
              id="new-username" name="new-username" autoComplete="username"
              placeholder="输入用户名（2-30 字符）"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={loading}
              autoFocus
            />
          )}

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
            >
              {isNewUser ? <UserPlus className="h-4 w-4 mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              {isNewUser ? "创建并进入" : "进入"}
            </Button>
            {selectedUser && selectedUser !== "__new__" && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            数据保存在浏览器本地，服务器在线时自动同步
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { BookOpen, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Loader2 } from "lucide-react";

interface Props {
  onLogin: (username: string, isJoin: boolean) => Promise<void>;
  error?: string | null;
  syncing?: boolean;
}

export function UsernameLogin({ onLogin, error, syncing }: Props) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (isJoin: boolean) => {
    if (!username.trim()) return;
    setLoading(true);
    try { await onLogin(username.trim(), isJoin); }
    finally { setLoading(false); }
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
            输入用户名以创建或加入已有的阅读空间
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="输入用户名..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin(false)}
            disabled={loading}
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleLogin(true)}
              disabled={loading || !username.trim()}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              创建新用户
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleLogin(false)}
              disabled={loading || !username.trim()}
            >
              <LogIn className="h-4 w-4 mr-2" />
              加入已有
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

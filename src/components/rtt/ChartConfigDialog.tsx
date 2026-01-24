/**
 * 图表配置对话框
 */

import { useState } from "react";
import { useRttStore } from "@/stores/rttStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Plus, Trash2 } from "lucide-react";
import type { ChartConfig, ParseMode, ChartType } from "@/lib/chartTypes";
import { PRESET_COLORS } from "@/lib/chartTypes";

interface ChartConfigDialogProps {
  trigger?: React.ReactNode;
}

export function ChartConfigDialog({ trigger }: ChartConfigDialogProps) {
  const { chartConfig, setChartConfig } = useRttStore();
  const [open, setOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<ChartConfig>(chartConfig);

  // 打开对话框时同步配置
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalConfig(chartConfig);
    }
    setOpen(newOpen);
  };

  // 保存配置
  const handleSave = () => {
    setChartConfig(localConfig);
    setOpen(false);
  };

  // 添加字段
  const handleAddField = () => {
    setLocalConfig({
      ...localConfig,
      fields: [
        ...localConfig.fields,
        {
          index: localConfig.fields.length,
          name: `字段${localConfig.fields.length + 1}`,
          enabled: true,
        },
      ],
    });
  };

  // 删除字段
  const handleRemoveField = (index: number) => {
    setLocalConfig({
      ...localConfig,
      fields: localConfig.fields.filter((_, i) => i !== index),
    });
  };

  // 添加系列
  const handleAddSeries = () => {
    const colorIndex = localConfig.series.length % PRESET_COLORS.length;
    setLocalConfig({
      ...localConfig,
      series: [
        ...localConfig.series,
        {
          key: `series${localConfig.series.length + 1}`,
          name: `系列${localConfig.series.length + 1}`,
          color: PRESET_COLORS[colorIndex],
          visible: true,
        },
      ],
    });
  };

  // 删除系列
  const handleRemoveSeries = (index: number) => {
    setLocalConfig({
      ...localConfig,
      series: localConfig.series.filter((_, i) => i !== index),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1">
            <Settings className="h-3.5 w-3.5" />
            配置图表
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>图表配置</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">基础</TabsTrigger>
            <TabsTrigger value="regex">正则</TabsTrigger>
            <TabsTrigger value="delimiter">分隔符</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          {/* 基础配置 */}
          <TabsContent value="basic" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">启用图表功能</Label>
              <Switch
                id="enabled"
                checked={localConfig.enabled}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parseMode">解析模式</Label>
              <Select
                value={localConfig.parseMode}
                onValueChange={(value: ParseMode) =>
                  setLocalConfig({ ...localConfig, parseMode: value })
                }
              >
                <SelectTrigger id="parseMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自动（按优先级尝试）</SelectItem>
                  <SelectItem value="regex">正则表达式</SelectItem>
                  <SelectItem value="delimiter">分隔符</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chartType">图表类型</Label>
              <Select
                value={localConfig.chartType}
                onValueChange={(value: ChartType) =>
                  setLocalConfig({ ...localConfig, chartType: value })
                }
              >
                <SelectTrigger id="chartType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">折线图</SelectItem>
                  <SelectItem value="bar">柱状图</SelectItem>
                  <SelectItem value="scatter">散点图</SelectItem>
                  <SelectItem value="xy-scatter">XY 散点图</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* XY 散点图配置 */}
            {localConfig.chartType === "xy-scatter" && (
              <div className="space-y-2">
                <Label htmlFor="xAxisField">X 轴字段</Label>
                <Input
                  id="xAxisField"
                  placeholder="输入 X 轴字段名（如: x, time, angle）"
                  value={localConfig.xAxisField || ""}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, xAxisField: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  指定哪个字段作为 X 轴，其他字段将作为 Y 轴系列
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maxDataPoints">最大数据点数</Label>
              <Input
                id="maxDataPoints"
                type="number"
                value={localConfig.maxDataPoints}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    maxDataPoints: parseInt(e.target.value) || 1000,
                  })
                }
              />
            </div>

            {/* 数据系列配置 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>数据系列</Label>
                <Button size="sm" variant="outline" onClick={handleAddSeries}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加
                </Button>
              </div>
              <div className="space-y-2">
                {localConfig.series.map((series, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    <Input
                      placeholder="键名"
                      value={series.key}
                      onChange={(e) => {
                        const newSeries = [...localConfig.series];
                        newSeries[index].key = e.target.value;
                        setLocalConfig({ ...localConfig, series: newSeries });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="显示名称"
                      value={series.name}
                      onChange={(e) => {
                        const newSeries = [...localConfig.series];
                        newSeries[index].name = e.target.value;
                        setLocalConfig({ ...localConfig, series: newSeries });
                      }}
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={series.color}
                      onChange={(e) => {
                        const newSeries = [...localConfig.series];
                        newSeries[index].color = e.target.value;
                        setLocalConfig({ ...localConfig, series: newSeries });
                      }}
                      className="w-12 h-8 rounded border cursor-pointer"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSeries(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 正则配置 */}
          <TabsContent value="regex" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="regexEnabled">启用正则解析</Label>
              <Switch
                id="regexEnabled"
                checked={localConfig.regexEnabled}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, regexEnabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regexPattern">正则表达式（使用命名捕获组）</Label>
              <Input
                id="regexPattern"
                placeholder="例如: temp:(?<temp>\d+\.?\d*)"
                value={localConfig.regexPattern}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, regexPattern: e.target.value })
                }
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                使用命名捕获组 (?&lt;name&gt;pattern) 来提取数值
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="regexFlags">正则标志（可选）</Label>
              <Input
                id="regexFlags"
                placeholder="例如: g, gi"
                value={localConfig.regexFlags || ""}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, regexFlags: e.target.value })
                }
              />
            </div>
          </TabsContent>

          {/* 分隔符配置 */}
          <TabsContent value="delimiter" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="delimiterEnabled">启用分隔符解析</Label>
              <Switch
                id="delimiterEnabled"
                checked={localConfig.delimiterEnabled}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, delimiterEnabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delimiter">分隔符</Label>
              <Select
                value={localConfig.delimiter}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, delimiter: value })
                }
              >
                <SelectTrigger id="delimiter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">逗号 (,)</SelectItem>
                  <SelectItem value="\t">制表符 (\t)</SelectItem>
                  <SelectItem value=" ">空格 ( )</SelectItem>
                  <SelectItem value=";">分号 (;)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>字段配置</Label>
                <Button size="sm" variant="outline" onClick={handleAddField}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加
                </Button>
              </div>
              <div className="space-y-2">
                {localConfig.fields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    <Input
                      type="number"
                      placeholder="索引"
                      value={field.index}
                      onChange={(e) => {
                        const newFields = [...localConfig.fields];
                        newFields[index].index = parseInt(e.target.value) || 0;
                        setLocalConfig({ ...localConfig, fields: newFields });
                      }}
                      className="w-20"
                    />
                    <Input
                      placeholder="字段名称"
                      value={field.name}
                      onChange={(e) => {
                        const newFields = [...localConfig.fields];
                        newFields[index].name = e.target.value;
                        setLocalConfig({ ...localConfig, fields: newFields });
                      }}
                      className="flex-1"
                    />
                    <Switch
                      checked={field.enabled}
                      onCheckedChange={(checked) => {
                        const newFields = [...localConfig.fields];
                        newFields[index].enabled = checked;
                        setLocalConfig({ ...localConfig, fields: newFields });
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveField(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* JSON 配置 */}
          <TabsContent value="json" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="jsonEnabled">启用 JSON 解析</Label>
              <Switch
                id="jsonEnabled"
                checked={localConfig.jsonEnabled}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, jsonEnabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>JSON 键（留空表示提取所有数值字段）</Label>
              <Input
                placeholder="例如: temp,humi,press（逗号分隔）"
                value={localConfig.jsonKeys?.join(",") || ""}
                onChange={(e) => {
                  const keys = e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter((k) => k);
                  setLocalConfig({
                    ...localConfig,
                    jsonKeys: keys.length > 0 ? keys : undefined,
                  });
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

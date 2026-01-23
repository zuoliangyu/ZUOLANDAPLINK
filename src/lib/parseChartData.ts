/**
 * RTT 图表数据解析工具
 */

import type { ChartConfig, ChartDataPoint } from "./chartTypes";

/**
 * 解析结果
 */
export interface ParseResult {
  /** 是否成功 */
  success: boolean;
  /** 解析出的数据点 */
  dataPoint?: ChartDataPoint;
  /** 错误信息 */
  error?: string;
  /** 使用的解析方法 */
  method?: "regex" | "delimiter" | "json";
}

/**
 * 使用正则表达式解析数据
 */
export function parseWithRegex(
  text: string,
  pattern: string,
  flags?: string
): ParseResult {
  try {
    const regex = new RegExp(pattern, flags);
    const match = regex.exec(text);

    if (!match || !match.groups) {
      return {
        success: false,
        error: "正则表达式未匹配或未使用命名捕获组",
      };
    }

    const values: Record<string, number> = {};
    for (const [key, value] of Object.entries(match.groups)) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        values[key] = num;
      }
    }

    if (Object.keys(values).length === 0) {
      return {
        success: false,
        error: "未提取到有效数值",
      };
    }

    return {
      success: true,
      dataPoint: {
        timestamp: Date.now(),
        values,
      },
      method: "regex",
    };
  } catch (error) {
    return {
      success: false,
      error: `正则表达式错误: ${error}`,
    };
  }
}

/**
 * 使用分隔符解析数据
 */
export function parseWithDelimiter(
  text: string,
  delimiter: string,
  fields: Array<{ index: number; name: string; enabled: boolean }>
): ParseResult {
  try {
    const parts = text.split(delimiter);
    const values: Record<string, number> = {};

    for (const field of fields) {
      if (!field.enabled) continue;

      if (field.index >= parts.length) {
        continue; // 跳过超出范围的字段
      }

      const value = parts[field.index].trim();
      const num = parseFloat(value);

      if (!isNaN(num)) {
        values[field.name] = num;
      }
    }

    if (Object.keys(values).length === 0) {
      return {
        success: false,
        error: "未提取到有效数值",
      };
    }

    return {
      success: true,
      dataPoint: {
        timestamp: Date.now(),
        values,
      },
      method: "delimiter",
    };
  } catch (error) {
    return {
      success: false,
      error: `分隔符解析错误: ${error}`,
    };
  }
}

/**
 * 使用 JSON 解析数据
 */
export function parseWithJson(
  text: string,
  keys?: string[]
): ParseResult {
  try {
    const data = JSON.parse(text);

    if (typeof data !== "object" || data === null) {
      return {
        success: false,
        error: "JSON 数据不是对象",
      };
    }

    const values: Record<string, number> = {};

    // 如果指定了 keys，只提取这些键
    const targetKeys = keys && keys.length > 0 ? keys : Object.keys(data);

    for (const key of targetKeys) {
      const value = data[key];
      if (typeof value === "number" && !isNaN(value)) {
        values[key] = value;
      }
    }

    if (Object.keys(values).length === 0) {
      return {
        success: false,
        error: "未提取到有效数值",
      };
    }

    return {
      success: true,
      dataPoint: {
        timestamp: Date.now(),
        values,
      },
      method: "json",
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON 解析错误: ${error}`,
    };
  }
}

/**
 * 自动解析（按优先级尝试）
 */
export function parseAuto(
  text: string,
  config: ChartConfig
): ParseResult {
  // 1. 尝试 JSON 解析
  if (config.jsonEnabled) {
    const result = parseWithJson(text, config.jsonKeys);
    if (result.success) {
      return result;
    }
  }

  // 2. 尝试正则表达式解析
  if (config.regexEnabled && config.regexPattern) {
    const result = parseWithRegex(
      text,
      config.regexPattern,
      config.regexFlags
    );
    if (result.success) {
      return result;
    }
  }

  // 3. 尝试分隔符解析
  if (config.delimiterEnabled && config.fields.length > 0) {
    const result = parseWithDelimiter(
      text,
      config.delimiter,
      config.fields
    );
    if (result.success) {
      return result;
    }
  }

  return {
    success: false,
    error: "所有解析方法均失败",
  };
}

/**
 * 主解析函数
 */
export function parseChartData(
  text: string,
  config: ChartConfig
): ParseResult {
  if (!config.enabled) {
    return {
      success: false,
      error: "图表功能未启用",
    };
  }

  switch (config.parseMode) {
    case "regex":
      if (!config.regexEnabled || !config.regexPattern) {
        return {
          success: false,
          error: "正则表达式未配置",
        };
      }
      return parseWithRegex(
        text,
        config.regexPattern,
        config.regexFlags
      );

    case "delimiter":
      if (!config.delimiterEnabled || config.fields.length === 0) {
        return {
          success: false,
          error: "分隔符配置不完整",
        };
      }
      return parseWithDelimiter(
        text,
        config.delimiter,
        config.fields
      );

    case "json":
      if (!config.jsonEnabled) {
        return {
          success: false,
          error: "JSON 解析未启用",
        };
      }
      return parseWithJson(text, config.jsonKeys);

    case "auto":
      return parseAuto(text, config);

    default:
      return {
        success: false,
        error: "未知的解析模式",
      };
  }
}

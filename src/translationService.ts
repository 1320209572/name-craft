import axios from 'axios';
import * as vscode from 'vscode';

interface TranslationResult {
    text: string;
    confidence: number;
    service: string;
}

export class TranslationService {
    private cache = new Map<string, TranslationResult[]>();

    private getApiKey(): string {
        const config = vscode.workspace.getConfiguration('namecraft');
        const apiKey = config.get<string>('siliconflowApiKey', '');
        
        if (!apiKey) {
            throw new Error('请先在设置中配置 SiliconFlow API Key\n\n获取地址: https://cloud.siliconflow.cn/me/account/ak');
        }
        
        return apiKey;
    }

    async translate(chineseText: string): Promise<TranslationResult[]> {
        const cacheKey = chineseText;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const results = await this.translateWithSiliconFlow(chineseText);
        console.log(results, "results1111")
        this.cache.set(cacheKey, results);
        return results;
    }


    // 通用：转换为指定格式
    async translateToStyle(chineseText: string, style: string): Promise<string> {
        const cacheKey = `${style}:${chineseText}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)![0].text;
        }

        const result = await this.translateWithStylePrompt(chineseText, style);
        this.cache.set(cacheKey, [{text: result, confidence: 1, service: style}]);
        return result;
    }

    // 智能中文翻译：返回3个最佳建议
    async getSmartTranslationSuggestions(chineseText: string, language: string, variableType: string): Promise<string[]> {
        try {
            const apiKey = this.getApiKey();
            
            const prompt = `请将中文"${chineseText}"翻译为${language}编程语言中的${variableType}名称。

要求：
1. 提供3个不同的英文命名建议
2. 根据${language}语言规范选择合适的命名风格：
   - JavaScript/TypeScript: camelCase (如: userName, dataList)
   - Python: snake_case (如: user_name, data_list)  
   - Java/C#: camelCase (如: userName, dataManager)
   - C/C++: snake_case或camelCase (如: user_data, userData)
3. ${variableType === 'class' ? '类名使用PascalCase格式' : '变量使用camelCase格式'}
4. 命名要简洁、语义清晰
5. 只返回JSON格式：

{
  "suggestions": ["建议1", "建议2", "建议3"]
}

示例：
中文："用户数据" → {"suggestions": ["userData", "userInfo", "userRecord"]}
中文："文件管理器" → {"suggestions": ["fileManager", "fileHandler", "documentManager"]}`;

            const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
                model: "deepseek-ai/DeepSeek-V3",
                max_tokens: 80,
                enable_thinking: false,
                temperature: 0.3,
                top_p: 0.7,
                n: 1,
                messages: [
                    { role: "user", content: prompt }
                ]
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            let cleanData = response.data?.choices?.[0]?.message?.content?.trim() || '';
            
            // 清理并解析JSON
            try {
                cleanData = cleanData.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
                const aiResponse = JSON.parse(cleanData);
                
                if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions)) {
                    return aiResponse.suggestions.slice(0, 3);
                }
            } catch (e) {
                console.warn('AI返回格式不正确，尝试提取建议:', cleanData);
                // fallback: 尝试从文本中提取变量名
                const fallbackSuggestions = cleanData.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
                return fallbackSuggestions.slice(0, 3);
            }
            
            return ['defaultName'];
            
        } catch (error: any) {
            throw new Error(`智能翻译失败: ${error.message}`);
        }
    }

    // 智能占位符替换：分析代码上下文返回4个建议
    async getSmartNamingSuggestions(codeBlock: string, language: string): Promise<string[]> {
        try {
            const apiKey = this.getApiKey();
            
            const prompt = `请分析以下${language}代码，为其中的占位符变量"temp"提供更有意义的命名建议：

代码：
\`\`\`${language.toLowerCase()}
${codeBlock}
\`\`\`

要求：
1. 分析代码上下文和功能
2. 必须提供恰好4个不同的有意义变量名建议
3. 根据代码语言选择合适的命名风格：
   - JavaScript/TypeScript: camelCase (如: userName, dataList)
   - Python: snake_case (如: user_name, data_list)
   - Java/C#: camelCase (如: userName, dataManager)
   - 其他语言: camelCase
4. 命名要简洁、语义清晰、符合编程规范
5. 严格按如下JSON格式返回，不要任何额外文字：

{
  "suggestions": ["suggestion1", "suggestion2", "suggestion3", "suggestion4"]
}

示例：
输入: foo.name
输出: {"suggestions": ["userName", "personName", "accountName", "profileName"]}`;

            const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
                model: "deepseek-ai/DeepSeek-V3",
                max_tokens: 150,
                enable_thinking: false,
                temperature: 0.3,
                top_p: 0.7,
                n: 1,
                messages: [
                    { role: "user", content: prompt }
                ]
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            let cleanData = response.data?.choices?.[0]?.message?.content?.trim() || '';
            
            // 清理并解析JSON
            try {
                cleanData = cleanData.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
                const aiResponse = JSON.parse(cleanData);
                
                if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions)) {
                    return aiResponse.suggestions.slice(0, 4);
                }
            } catch (e) {
                console.warn('AI返回格式不正确，尝试提取建议:', cleanData);
            }
            
            // fallback: 尝试从文本中提取变量名
            const fallbackSuggestions = cleanData.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
            const suggestions = fallbackSuggestions.slice(0, 4);
            
            // 确保返回4个建议，不足的话补充默认建议
            while (suggestions.length < 4) {
                const defaultSuggestions = ['variable', 'data', 'item', 'value'];
                suggestions.push(defaultSuggestions[suggestions.length] || `option${suggestions.length + 1}`);
            }
            
            return suggestions;
            
        } catch (error: any) {
            throw new Error(`智能命名分析失败: ${error.message}`);
        }
    }

    private async translateWithSiliconFlow(text: string): Promise<TranslationResult[]> {
        try {
            const apiKey = this.getApiKey();
            
            const prompt = `请将以下中文翻译成英文变量名，要求：
1. 提供3-5个不同的翻译选项
2. 每个选项包含三种格式：camelCase、PascalCase、snake_case
3. 语义准确，简洁明了
4. 按如下JSON格式返回，不要其他解释：
{
  "options": [
    {
      "camelCase": "example",
      "PascalCase": "Example", 
      "snake_case": "example"
    }
  ]
}

要翻译的中文：${text}`;

            const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
                model: "deepseek-ai/DeepSeek-V3",
                max_tokens: 300,
                enable_thinking: false,
                temperature: 0.3,
                top_p: 0.5,
                n: 1,
                messages: [
                    { role: "user", content: prompt }
                ]
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });
    
            let cleanData = response.data?.choices?.[0]?.message?.content?.trim() || '';
    
            // 多选项模式应该返回JSON，但API可能仍返回字符串
            // 先尝试解析JSON
            let aiResponse;
            try {
                if (typeof cleanData === 'string') {
                    // 去掉可能的代码块标记
                    cleanData = cleanData.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
                    aiResponse = JSON.parse(cleanData);
                } else {
                    aiResponse = cleanData;
                }
            } catch (e) {
                // 如果解析失败，可能AI没有返回正确的JSON格式
                // 创建一个基础的翻译结果作为fallback
                console.warn('AI返回格式不正确，使用fallback处理:', cleanData);
                return [{
                    text: this.extractVariableName(cleanData),
                    confidence: 0.8,
                    service: 'local-api-fallback'
                }];
            }
    
            if (!aiResponse.options || !Array.isArray(aiResponse.options)) {
                // 如果没有options结构，尝试直接处理
                console.warn('AI返回结构异常，使用fallback处理');
                return [{
                    text: this.extractVariableName(cleanData),
                    confidence: 0.8,
                    service: 'local-api-fallback'
                }];
            }
    
            const results: TranslationResult[] = [];
            aiResponse.options.forEach((option: any, index: number) => {
                const confidence = 0.95 - index * 0.05;
                if (option.camelCase) results.push({ text: option.camelCase, confidence, service: 'local-api-camelCase' });
                if (option.PascalCase) results.push({ text: option.PascalCase, confidence, service: 'local-api-PascalCase' });
                if (option.snake_case) results.push({ text: option.snake_case, confidence, service: 'local-api-snake_case' });
            });
    
            return results.length > 0 ? results : [{
                text: this.extractVariableName(cleanData),
                confidence: 0.8,
                service: 'local-api-fallback'
            }];
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('翻译服务超时，请稍后重试');
            } else if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                if (status === 401) {
                    throw new Error('模型调用错误,请检查配置\n\nAPI密钥无效，请到 SiliconFlow 控制台获取新的API Key:\nhttps://cloud.siliconflow.cn/me/account/ak');
                } else if (status === 429) {
                    throw new Error('请求过于频繁，请稍后再试');
                } else if (status === 500) {
                    throw new Error(`模型调用错误,请检查配置 - ${data.error?.message || '服务器内部错误'}`);
                } else {
                    throw new Error(`API调用失败 (${status}): ${data.error?.message || error.message}`);
                }
            } else {
                throw new Error(`网络连接失败: ${error.message}`);
            }
        }
    }

    private async translateWithStylePrompt(text: string, style: string): Promise<string> {
        try {
            const apiKey = this.getApiKey();
            
            const styleMap: Record<string, string> = {
                'camelCase': 'camelCase (小驼峰，如: userName)',
                'PascalCase': 'PascalCase (大驼峰，如: UserName)',
                'snake_case': 'snake_case (下划线，如: user_name)',
                '_snake_case': '前下划线 (如: _user_name)',
                'CONSTANT_CASE': 'CONSTANT_CASE (常量，如: USER_NAME)',
                'kebab-case': 'kebab-case (短横线，如: user-name)'
            };

            const prompt = `请将以下中文直接转换为一个合适的英文${styleMap[style] || style}格式变量名：

要求：
1. 只返回一个最佳的${style}格式变量名
2. 语义准确，简洁明了  
3. 符合编程规范
4. 直接返回变量名，不要任何解释或格式包装

中文：${text}`;

            const response = await axios.post('https://api.siliconflow.cn/v1/chat/completions', {
                model: "deepseek-ai/DeepSeek-V3",
                max_tokens: 20,
                enable_thinking: false,
                temperature: 0.1,
                top_p: 0.5,
                n: 1,
                messages: [
                    { role: "user", content: prompt }
                ]
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            let result = response.data?.choices?.[0]?.message?.content?.trim() || '';
            
            // 清理返回结果，只保留变量名
            if (typeof result === 'string') {
                result = result.trim()
                    .replace(/^```.*$/gm, '') // 去掉代码块标记
                    .replace(/^\s*[\{\}\[\]"'`]/gm, '') // 去掉JSON符号
                    .replace(/^[^a-zA-Z_]*/, '') // 去掉开头的非字母字符
                    .replace(/[^a-zA-Z0-9_].*$/, '') // 保留有效的变量名部分
                    .trim();
            }

            return result || 'defaultName';
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('模型调用错误,请检查配置\n\nAPI密钥无效，请到 SiliconFlow 控制台获取新的API Key:\nhttps://cloud.siliconflow.cn/me/account/ak');
            }
            throw new Error(`${style}翻译失败: ${error.message}`);
        }
    }

    // 从响应中提取变量名的helper方法
    private extractVariableName(text: string): string {
        if (!text || typeof text !== 'string') {
            return 'defaultName';
        }
        
        // 清理文本，提取可能的变量名
        const cleaned = text.trim()
            .replace(/^```.*$/gm, '') // 去掉代码块
            .replace(/^\s*[\{\}\[\]"'`]/gm, '') // 去掉JSON符号
            .replace(/[^\w]/g, ' ') // 替换非字母数字为空格
            .trim()
            .split(/\s+/)[0]; // 取第一个单词
            
        // 如果提取失败，返回默认值
        return cleaned || 'defaultName';
    }
}

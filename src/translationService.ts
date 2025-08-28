import axios from 'axios';

interface TranslationResult {
    text: string;
    confidence: number;
    service: string;
}

export class TranslationService {
    private cache = new Map<string, TranslationResult[]>();

    async translate(chineseText: string): Promise<TranslationResult[]> {
        const cacheKey = chineseText;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const results = await this.translateWithGoogle(chineseText);
        console.log(results, "results1111")
        this.cache.set(cacheKey, results);
        return results;
    }

    // F2专用：直接返回驼峰格式
    async translateToCamelCase(chineseText: string): Promise<string> {
        const cacheKey = `camelCase:${chineseText}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)![0].text;
        }

        const result = await this.translateWithCamelCasePrompt(chineseText);
        this.cache.set(cacheKey, [{text: result, confidence: 1, service: 'camelCase'}]);
        return result;
    }

    private async translateWithGoogle(text: string): Promise<TranslationResult[]> {
        try {
            const response = await axios.post('http://localhost:3000/api/process', {
                text: `请将以下中文翻译成英文变量名，要求：
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
    
    要翻译的中文：${text}`
            }, { timeout: 60000 });
    
            if (!response.data.success) {
                throw new Error(response.data.message || '本地API调用失败');
            }
    
            let cleanData = response.data.data;
    
            // 去掉 ```json ``` 代码块
            if (typeof cleanData === 'string') {
                cleanData = cleanData.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
            }
    
            let aiResponse;
            try {
                aiResponse = typeof cleanData === 'string' ? JSON.parse(cleanData) : cleanData;
            } catch (e) {
                throw new Error('AI 返回的不是合法 JSON：' + cleanData);
            }
    
            if (!aiResponse.options || !Array.isArray(aiResponse.options)) {
                throw new Error('AI 返回结构缺少 options');
            }
    
            const results: TranslationResult[] = [];
            aiResponse.options.forEach((option: any, index: number) => {
                const confidence = 0.95 - index * 0.05;
                if (option.camelCase) results.push({ text: option.camelCase, confidence, service: 'local-api-camelCase' });
                if (option.PascalCase) results.push({ text: option.PascalCase, confidence, service: 'local-api-PascalCase' });
                if (option.snake_case) results.push({ text: option.snake_case, confidence, service: 'local-api-snake_case' });
            });
    
            return results;
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('翻译服务超时，请检查本地API服务是否正常运行');
            } else if (error.code === 'ECONNREFUSED') {
                throw new Error('无法连接到翻译服务，请确保本地API服务(端口3000)正在运行');
            } else {
                throw new Error(`翻译服务调用失败: ${error.message}`);
            }
        }
    }

    private async translateWithCamelCasePrompt(text: string): Promise<string> {
        try {
            const response = await axios.post('http://localhost:3000/api/process', {
                text: `请将以下中文直接转换为一个合适的英文camelCase格式变量名：
要求：
1. 只返回一个最佳的camelCase格式变量名
2. 语义准确，简洁明了
3. 符合编程规范
4. 直接返回变量名，不要任何解释或格式包装

中文：${text}`
            }, { timeout: 60000 });

            if (!response.data.success) {
                throw new Error(response.data.message || 'F2翻译API调用失败');
            }

            let result = response.data.data;
            
            // 清理返回结果，只保留变量名
            if (typeof result === 'string') {
                result = result.trim()
                    .replace(/^```.*$/gm, '') // 去掉代码块标记
                    .replace(/^\s*[\{\}\[\]"'`]/gm, '') // 去掉JSON符号
                    .replace(/\s.*$/, '') // 只保留第一个单词/变量名
                    .trim();
            }

            return result;
        } catch (error: any) {
            throw new Error(`F2翻译失败: ${error.message}`);
        }
    }
}

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
}

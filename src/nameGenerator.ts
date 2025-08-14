interface NamingStyle {
    name: string;
    transform: (words: string[]) => string;
    validator: (name: string) => boolean;
}

interface GeneratedName {
    name: string;
    style: string;
    score: number;
    reason: string;
}

const NAMING_STYLES: Record<string, NamingStyle> = {
    camelCase: {
        name: 'camelCase',
        transform: (words: string[]) => {
            if (words.length === 0) return '';
            return words[0].toLowerCase() + 
                   words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        },
        validator: (name: string) => /^[a-z][a-zA-Z0-9]*$/.test(name)
    },
    PascalCase: {
        name: 'PascalCase',
        transform: (words: string[]) => {
            return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        },
        validator: (name: string) => /^[A-Z][a-zA-Z0-9]*$/.test(name)
    },
    snake_case: {
        name: 'snake_case',
        transform: (words: string[]) => {
            return words.map(w => w.toLowerCase()).join('_');
        },
        validator: (name: string) => /^[a-z][a-z0-9_]*[a-z0-9]$/.test(name)
    },
    'kebab-case': {
        name: 'kebab-case',
        transform: (words: string[]) => {
            return words.map(w => w.toLowerCase()).join('-');
        },
        validator: (name: string) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)
    },
    CONSTANT_CASE: {
        name: 'CONSTANT_CASE',
        transform: (words: string[]) => {
            return words.map(w => w.toUpperCase()).join('_');
        },
        validator: (name: string) => /^[A-Z][A-Z0-9_]*[A-Z0-9]$/.test(name)
    }
};

export class NameGenerator {
    
    generateNames(translatedText: string, styles: string[] = ['camelCase']): GeneratedName[] {
        if (!translatedText || translatedText.trim().length === 0) {
            return [];
        }

        const results: GeneratedName[] = [];
        const words = this.parseTranslatedText(translatedText);

        for (const styleName of styles) {
            const style = NAMING_STYLES[styleName];
            if (!style) continue;

            const name = style.transform(words);
            if (this.isValidName(name, style)) {
                const score = this.calculateScore(name, words);
                results.push({
                    name,
                    style: styleName,
                    score,
                    reason: `${styleName}风格命名`
                });
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }

    private parseTranslatedText(translatedText: string): string[] {
        // 处理后端API返回的翻译结果
        const cleanText = translatedText.trim();
        
        // 如果是驼峰命名，拆分单词
        if (/^[a-z][a-zA-Z0-9]*$/.test(cleanText)) {
            return this.splitCamelCase(cleanText);
        }
        
        // 如果是下划线命名，按下划线拆分
        if (cleanText.includes('_')) {
            return cleanText.split('_').filter(word => word.length > 0);
        }
        
        // 如果是连字符命名，按连字符拆分
        if (cleanText.includes('-')) {
            return cleanText.split('-').filter(word => word.length > 0);
        }
        
        // 如果是空格分隔，按空格拆分
        if (cleanText.includes(' ')) {
            return cleanText.split(' ').filter(word => word.length > 0);
        }
        
        // 否则作为单个词处理
        return [cleanText];
    }
    
    private splitCamelCase(text: string): string[] {
        return text.split(/(?=[A-Z])/).filter(word => word.length > 0);
    }


    private isValidName(name: string, style: NamingStyle): boolean {
        return name.length > 0 && 
               name.length <= 50 && 
               style.validator(name) &&
               this.isReadable(name);
    }

    private isReadable(name: string): boolean {
        // 检查是否有太多连续的辅音
        const consonantPattern = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{4,}/;
        if (consonantPattern.test(name)) {
            return false;
        }
        
        // 检查是否包含不合适的字符组合
        const badPatterns = [
            /(.)\1{3,}/, // 连续4个相同字符
            /^[0-9]/, // 以数字开头
            /[^a-zA-Z0-9_-]/ // 包含特殊字符
        ];
        
        return !badPatterns.some(pattern => pattern.test(name));
    }

    private calculateScore(name: string, words: string[]): number {
        let score = 100;
        
        // 长度评分
        const length = name.length;
        if (length >= 5 && length <= 15) {
            score += 10;
        } else if (length > 20) {
            score -= 20;
        }
        
        // 可读性评分
        if (this.hasGoodReadability(name)) {
            score += 15;
        }
        
        // 语义完整性评分
        if (words.length > 1) {
            score += words.length * 5;
        }
        
        // 常见单词奖励
        if (this.containsCommonWords(name)) {
            score += 5;
        }
        
        return Math.max(0, Math.min(100, score));
    }

    private hasGoodReadability(name: string): boolean {
        // 检查元音分布
        const vowels = name.match(/[aeiouAEIOU]/g);
        const vowelRatio = vowels ? vowels.length / name.length : 0;
        return vowelRatio >= 0.2 && vowelRatio <= 0.6;
    }


    private containsCommonWords(name: string): boolean {
        const commonWords = [
            'get', 'set', 'is', 'has', 'can', 'should', 'will',
            'user', 'data', 'info', 'config', 'handle', 'process'
        ];
        
        return commonWords.some(word => 
            name.toLowerCase().includes(word.toLowerCase())
        );
    }
}
// 简化版语义分析器，不再使用本地分词
export class SemanticAnalyzer {
    
    // 简单的中文检测和基本分析
    analyze(text: string): {
        keywords: string[];
        intent: string;
        context: string[];
    } {
        if (!text || typeof text !== 'string') {
            return {
                keywords: [],
                intent: 'unknown',
                context: []
            };
        }

        // 简单的关键词提取（基于文本本身）
        const keywords = [text.trim()];
        
        return {
            keywords,
            intent: 'general',
            context: ['naming']
        };
    }
}
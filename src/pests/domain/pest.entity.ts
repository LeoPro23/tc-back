export class PestDetection {
    constructor(
        public readonly box: number[],
        public readonly confidence: number,
        public readonly className: string,
        public readonly classId: number,
        public readonly model: string | null = null,
    ) { }
}

export interface AgronomicRecommendation {
    product: string;
    dose: string;
    method: string;
}

export interface PerImageInterpretation {
    filename: string;
    targetPest: string;
    imageRecommendation: string;
    recipe: AgronomicRecommendation;
    biosecurityStatus: string;
    biosecurityProtocol: string;
}

export interface BatchInterpretation {
    generalSummary: string;
    generalRecommendation: string;
    generalProduct: string;
    generalOperativeGuide: string;
    generalBiosecurityProtocol: string;
    perImage: PerImageInterpretation[];
}

export class PestAnalysisResult {
    constructor(
        public readonly filename: string,
        public readonly detections: PestDetection[],
        public readonly models: string[] = [],
        public readonly verified: boolean = true,
        public readonly verificationReason: string | null = null,
    ) { }
}

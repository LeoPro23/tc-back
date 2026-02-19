export class PestDetection {
    constructor(
        public readonly box: number[],
        public readonly confidence: number,
        public readonly className: string,
        public readonly classId: number,
    ) { }
}

export class PestAnalysisResult {
    constructor(
        public readonly filename: string,
        public readonly detections: PestDetection[],
    ) { }
}

import { IsDateString, IsOptional } from 'class-validator';

export class UpdateCampaignDto {
    @IsOptional()
    @IsDateString({}, { message: 'La fecha de inicio debe tener formato válido ISO8601' })
    startDate?: string;

    @IsOptional()
    @IsDateString({}, { message: 'La fecha de fin debe tener formato válido ISO8601' })
    endDate?: string;
}

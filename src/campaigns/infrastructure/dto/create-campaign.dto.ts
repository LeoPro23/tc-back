import { IsDateString, IsNotEmpty } from 'class-validator';

export class CreateCampaignDto {
    @IsNotEmpty({ message: 'La fecha de inicio es requerida' })
    @IsDateString({}, { message: 'La fecha de inicio debe tener formato válido ISO8601' })
    startDate: string;

    @IsNotEmpty({ message: 'La fecha de fin es requerida' })
    @IsDateString({}, { message: 'La fecha de fin debe tener formato válido ISO8601' })
    endDate: string;
}

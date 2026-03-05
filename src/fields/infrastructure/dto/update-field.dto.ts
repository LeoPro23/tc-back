import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFieldDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    irrigationType?: string;
}

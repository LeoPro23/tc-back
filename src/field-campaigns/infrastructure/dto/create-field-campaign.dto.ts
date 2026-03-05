import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateFieldCampaignDto {
  @IsNotEmpty({ message: 'El ID del campo es requerido' })
  @IsUUID('4', { message: 'El ID del campo debe ser un UUID válido' })
  fieldId: string;

  @IsNotEmpty({ message: 'El ID de la campaña es requerido' })
  @IsUUID('4', { message: 'El ID de la campaña debe ser un UUID válido' })
  campaignId: string;
}

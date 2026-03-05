import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFieldDto {
    @IsNotEmpty({ message: 'El nombre del campo es requerido' })
    @IsString({ message: 'El nombre del campo debe ser de texto' })
    @MaxLength(100, { message: 'El nombre de campo no debe exceder 100 caracteres' })
    name: string;
}

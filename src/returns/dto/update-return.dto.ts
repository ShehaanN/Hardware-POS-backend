import { PartialType } from '@nestjs/swagger';
import { CreateReturnDto } from './create-return.dto';

export class UpdateReturnDto extends PartialType(CreateReturnDto) {}

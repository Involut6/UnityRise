import { IsArray, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;
  @Matches(/^(\+234|0)\d{10}$/) phone: string;
  @IsString() @Length(8, 72) password: string;
  @IsString() @Length(1, 60) firstName: string;
  @IsString() @Length(1, 60) lastName: string;
}
export class LoginDto { @IsEmail() email: string; @IsString() password: string; @IsOptional() @IsString() code?: string }
export class KycDto {
  @IsDateString() dateOfBirth: string;
  @Matches(/^\d{11}$/) bvn: string;
  @Matches(/^\d{11}$/) nin: string;
  @IsString() @Length(5, 300) address: string;
}
export class KycDocDto {
  @IsIn(['photo', 'id_card', 'signature', 'proof_of_address']) kind: string;
  @IsString() @MaxLength(200) filename: string;
  @IsString() @MaxLength(7_500_000) contentBase64: string;
}
export class ReviewDto { @IsIn(['approve', 'reject']) decision: 'approve' | 'reject'; @IsOptional() @IsString() note?: string }
export class AmountDto { @IsNumber() @Min(100) @Max(100_000_000) amount: number }
export class TargetDto { @IsNumber() @Min(0) monthlyTarget: number }
export class PayInitDto {
  @IsIn(['paystack', 'flutterwave']) provider: string;
  @IsIn(['topup', 'loan_repayment']) purpose: string;
  @IsNumber() @Min(100) amount: number;
  @IsOptional() @IsUUID() loanId?: string;
}
export class LoanApplyDto {
  @IsString() productCode: string;
  @IsNumber() @Min(1000) principal: number;
  @IsInt() @Min(1) @Max(120) tenorMonths: number;
  @IsOptional() @IsString() purpose?: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @IsString({ each: true }) guarantorMembershipIds: string[];
}
export class ConsentDto { @IsIn(['accepted', 'declined']) consent: string }
export class SchemeDto {
  @IsString() @Length(3, 120) title: string;
  @IsIn(['real_estate', 'treasury_bills', 'agriculture', 'equipment_leasing', 'business_financing']) category: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(1000) targetAmount: number;
  @IsNumber() @Min(0) minAmount: number;
  @IsInt() @Min(1) durationMonths: number;
  @IsNumber() @Min(0) @Max(200) projectedRoiPct: number;
  @IsIn(['low', 'medium', 'high']) riskProfile: string;
}
const CATEGORIES = ['real_estate', 'treasury_bills', 'agriculture', 'equipment_leasing', 'business_financing'];
export class UpdateSchemeDto {
  @IsOptional() @IsString() @Length(3, 120) title?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsNumber() @Min(1000) targetAmount?: number;
  @IsOptional() @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) durationMonths?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) projectedRoiPct?: number;
  @IsOptional() @IsIn(['low', 'medium', 'high']) riskProfile?: string;
  @IsOptional() @IsString() @Length(3, 500) reason?: string;
}
export class SchemeStatusDto { @IsIn(['close', 'reopen']) action: 'close' | 'reopen'; @IsOptional() @IsString() @Length(3, 500) reason?: string }
export class MatureDto { @IsNumber() @Min(-100) @Max(500) actualReturnPct: number }
export class AnnounceDto { @IsString() title: string; @IsString() body: string; @IsIn(['notice', 'meeting', 'agm']) kind: string }
export class PollDto {
  @IsString() question: string;
  @IsArray() @ArrayMinSize(2) @IsString({ each: true }) options: string[];
  @IsDateString() closesAt: string;
  @IsOptional() isResolution?: boolean;
}
export class VoteDto { @IsInt() @Min(0) optionIndex: number }
export class MeetingDto { @IsString() title: string; @IsDateString() heldAt: string; @IsOptional() @IsString() venue?: string }
export class MinutesDto { @IsString() minutes: string }

export class ChangePasswordDto { @IsString() current: string; @IsString() @Length(8, 72) next: string }

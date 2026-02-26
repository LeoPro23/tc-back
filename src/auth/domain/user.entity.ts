export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly name: string,
    public readonly role: string,
    public readonly createdAt: Date,
    public readonly farmName: string | null = null,
    public readonly isTwoFactorEnabled: boolean = false,
    public readonly twoFactorSecret: string | null = null,
  ) { }
}

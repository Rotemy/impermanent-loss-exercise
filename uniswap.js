/**
 * Simple AMM
 * No checks for if LP has liquidity or if ratio is correct
 */
class Uniswap {

    reserves = {
        A: 0,
        B: 0
    };

    lpTokens = {};
    totalTokens = 0;
    fees = {
        a: 0,
        b: 0
    };

    constructor(A, B, address) {
        this.reserves.A = A;
        this.reserves.B = B;

        this.lpTokens[address] = 1;
        this.totalTokens = 1;
    }

    addLiquidity(a, b, address) {
        this.reserves.A += a;
        this.reserves.B += b;

        const lpSharesRatio = (b + a) / (this.reserves.B + this.reserves.A);

        const lpShares = this.round((this.totalTokens * lpSharesRatio) / (1 - lpSharesRatio));

        this.totalTokens += lpShares;

        this.lpTokens[address] = (this.lpTokens[address] || 0) + lpShares;
    }

    removeLiquidity(a, b, address) {
        this.reserves.A -= a;
        this.reserves.B -= b;

        const lpSharesRatio = (b - a) / (this.reserves.B - this.reserves.A);

        const lpShares = this.round((this.totalTokens * lpSharesRatio) / (1 + lpSharesRatio));

        this.totalTokens -= lpShares;

        this.lpTokens[address] -= lpShares;

        return {
            a: this.reserves.A * lpSharesRatio,
            b: this.reserves.B * lpSharesRatio,
        };
    }

    swap(a, b) {
        let result;

        if (a) {
            this.fees.a += (a * 0.003);
            a *= 0.997;
            result = (((this.reserves.A + a) * this.reserves.B) - (this.reserves.A * this.reserves.B)) / (this.reserves.A + a);

            this.reserves.A += a;
            this.reserves.B -= result;
        } else {
            this.fees.b += (b * 0.003);
            b *= 0.997;
            result = (((this.reserves.B + b) * this.reserves.A) - (this.reserves.A * this.reserves.B)) / (this.reserves.B + b);

            this.reserves.B += b;
        }

        return result;
    }

    withdraw(address, ratio) {
        const lpTokens = this.lpTokens[address] * ratio;
        const lpSharesRatio = lpTokens / this.totalTokens;
        const tokens = {
            a: this.reserves.A * lpSharesRatio,
            b: this.reserves.B * lpSharesRatio,
        };
        this.totalTokens -= lpTokens;
        this.reserves.A -= tokens.a;
        this.reserves.B -= tokens.b;
        this.lpTokens[address] -= lpTokens;

        return tokens;
    }

    printPrice() {
        console.log('Prince is ', this.reserves.A / this.reserves.B);
    }

    print() {
        console.log("lpTokens", this.lpTokens);
        console.log("totalTokens", this.totalTokens);
        console.log("fees", this.fees);
        console.log("reserves", this.reserves);
    }

    // Just because JS cannot hold a long number so dividing or multiplying 0.33333333 will cause 0.999999998 and not 1
    round(value) {
        return parseFloat(value.toFixed(8));
    };

}

// const u = new Uniswap(4000, 2, 'rotem');
// u.addLiquidity(8000, 4, 'moshe');
// u.addLiquidity(12000, 6, 'rotem');
//
// u.print();

const u = new Uniswap(4000, 2, 'rotem');

u.addLiquidity(4000, 2, 'moshe');
u.addLiquidity(4000, 2, 'rotem');
u.removeLiquidity(4000, 2, 'rotem');
u.addLiquidity(4000, 2, 'moshe2');
u.addLiquidity(2000, 1, 'moshe3');
u.addLiquidity(14000, 7, 'moshe4');

u.printPrice();
u.swap(0, 0.5);
u.printPrice();
u.swap(500, 0);
u.printPrice();

u.print();

console.log(u.withdraw('moshe4', 1));

u.print();

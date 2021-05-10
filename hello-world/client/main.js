const fs = require('fs');
const path = require('path');
const { exit } = require('process');
const {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
    SystemProgram,
    TransactionInstruction,
} = require('@solana/web3.js');
const borsh = require('borsh');
require('dotenv').config();

// global var
const { GREETING_SIZE, GreetingAccount, GreetingSchema } = require('./greeting');
const PROGRAM_KEYPAIR_PATH = path.join(`${process.env.PROGRAM_PATH}`, 'helloworld-keypair.json');

const setRPC = async () => {
    const rpcUrl = `${process.env.RPC_URL}`;
    connection = new Connection(rpcUrl, 'confirmed');
    return connection;
};

const getPayer = async () => {
    try {
        const keypairString = fs.readFileSync(`${process.env.KEYPAIR_PATH}`, 'utf-8');
        const keypairBuffer = Buffer.from(JSON.parse(keypairString));
        const account = Keypair.fromSecretKey(keypairBuffer);
        return account;
    } catch (err) {
        throw new Error(err);
    }
};

const establishPayer = async (connection, payer) => {
    // fee calculation
    let fees = 0;
    const { feeCalculator } = await connection.getRecentBlockhash();
    fees += await connection.getMinimumBalanceForRentExemption(GREETING_SIZE);
    fees += feeCalculator.lamportsPerSignature * 100;
    const lamports = await connection.getBalance(payer.publicKey);
    console.log(
        'Using account',
        payer.publicKey.toBase58(),
        'containing',
        lamports / LAMPORTS_PER_SOL,
        'SOL to pay for fees',
        fees / LAMPORTS_PER_SOL,
    );
};

const checkProgram = async (connection, payer) => {
    // load program account
    let programAccount;
    let programID;
    try {
        const programString = fs.readFileSync(PROGRAM_KEYPAIR_PATH, 'utf-8');
        const programBuffer = Buffer.from(JSON.parse(programString));
        programAccount = Keypair.fromSecretKey(programBuffer);
        programID = programAccount.publicKey;
    } catch (err) {
        throw new Error(err)
    }
    // info
    const programInfo = await connection.getAccountInfo(programID);
    if (programInfo === null) {
        throw new Error('Program needs to be built and deployed');
    } else if (!programInfo.executable) {
        throw new Error(`Program is not executable`);
    }
    console.log(`Using program ${programID.toBase58()}`);

    // create account by seed to store `greeting`
    const GREETING_SEED = 'hello';
    greetedPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        GREETING_SEED,
        programID,
    );
    const greetedAccount = await connection.getAccountInfo(greetedPubkey);
    // null means that account is valid to be created
    if (greetedAccount === null) {
        console.log('Creating account', greetedPubkey.toBase58(), 'to say hello to');
        const lamports = await connection.getMinimumBalanceForRentExemption(GREETING_SIZE);
        const transaction = new Transaction().add(
            SystemProgram.createAccountWithSeed({
                fromPubkey: payer.publicKey,
                basePubkey: payer.publicKey,
                seed: GREETING_SEED,
                newAccountPubkey: greetedPubkey,
                lamports: lamports,
                space: GREETING_SIZE,
                programId: programID,
            }),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer]);
    }
    return {
        greetedPubkey,
        programID,
    };
};

const triggerProgram = async (connection, payer, greetedPubkey, programID) => {
    console.log('Saying hello to', greetedPubkey.toBase58());
    const instruction = new TransactionInstruction({
        keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
        programId: programID,
        data: Buffer.alloc(0),
    });
    await sendAndConfirmTransaction(
        connection,
        new Transaction().add(instruction),
        [payer],
    );
}

const report = async (connection, greetedPubkey) => {
    const accountInfo = await connection.getAccountInfo(greetedPubkey);
    if (accountInfo === null) {
        throw 'Error: cannot find the greeted account';
    }
    const greeting = borsh.deserialize(
        GreetingSchema,
        GreetingAccount,
        accountInfo.data,
    );
    console.log(
        greetedPubkey.toBase58(),
        'has been greeted',
        greeting.counter,
        'time(s)',
    );
}

(async () => {
    const conn = await setRPC();
    const payer = await getPayer();
    await establishPayer(conn, payer);
    const greeted = await checkProgram(conn, payer);
    await triggerProgram(conn, payer, greeted.greetedPubkey, greeted.programID);
    await report(conn, greeted.greetedPubkey);
    exit(0);
})();
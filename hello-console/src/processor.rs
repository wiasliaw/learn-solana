use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    log::{sol_log_compute_units, sol_log_params},
    msg,
    pubkey::Pubkey,
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("log static string");
    program_id.log();
    sol_log_compute_units();
    sol_log_params(accounts, instruction_data);
    Ok(())
}

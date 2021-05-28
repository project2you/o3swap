const vault = {
  Total: {
    en: 'Total',
    zh: '总额',
  },
  Locked: {
    en: 'Locked',
    zh: '冻结',
  },
  Available: {
    en: 'Available',
    zh: '可用的',
  },
  TotalProfit: {
    en: 'Total Profit',
    zh: '总利润',
  },
  Unlock: {
    en: 'Unlock',
    zh: '解锁',
  },
  Name: {
    en: 'Name',
    zh: '名称',
  },
  Staked: {
    en: 'Staked',
    zh: '已质押',
  },
  Remaining: {
    en: 'Remaining',
    zh: '可质押',
  },
  Speed: {
    en: 'Speed',
    zh: '解锁速度',
  },
  UnlockedAmount: {
    en: 'Unlocked Amount',
    zh: '解锁数量',
  },
  GetLP: {
    en: 'Get LP',
    zh: '取得 LP',
  },
  StakeLPToEarnO3: {
    en: 'Stake LP To Earn O3',
    zh: '流动性质押得O3',
  },
  TotalStaking: {
    en: 'Total Staking',
    zh: '总质押数',
  },
  StakeTokenToEarnO3: {
    en: 'Stake Token To Earn O3',
    zh: '单币质押得O3',
  },
  Claimable: {
    en: 'Claimable',
    zh: '可领取',
  },
  Stake: {
    en: 'Stake',
    zh: '质押',
  },
  Unstake: {
    en: 'Unstake',
    zh: '解锁',
  },
  Claim: {
    en: 'Claim',
    zh: '领取',
  },
  Cancel: {
    en: 'Cancel',
    zh: '取消',
  },
  unlockO3Tip: {
    en: 'Stake LP to unlock O3. See the recommended LP amount on unlock calculator.',
    zh: '质押LP解锁O3。可在解锁计算器上查看建议的LP数量。',
  },
  Amount: {
    en: 'Amount',
    zh: '数量',
  },
  Balance: {
    en: 'Balance',
    zh: '余额',
  },
  Confirm: {
    en: 'Confirm',
    zh: '确认',
  },
  CLAIM: {
    en: 'CLAIM',
    zh: '领取',
  },
  Airdrop: {
    en: 'Airdrop',
    zh: '空投',
  },
  recommendStakeLp: {
    en: (params: string[]) =>
      `Stake ${params[0]} ${params[1]} in total to reach the max unlock speed`,
    zh: (params: string[]) =>
      `总质押 ${params[0]} ${params[1]}可达到最大解锁速度`,
  },
  UnlockCalculator: {
    en: 'Unlock Calculator',
    zh: '解锁计算器',
  },
  LockedAmount: {
    en: 'Locked amount',
    zh: '待解锁数量',
  },
  RecommendedLP: {
    en: 'Recommended LP',
    zh: '推荐LP',
  },
  UnlockSpeed: {
    en: 'Unlock speed',
    zh: '解锁速度',
  },
  UnlockTime: {
    en: 'Unlock time',
    zh: '解锁时间',
  },
  O3Block: {
    en: 'O3/block',
    zh: 'O3/每区块',
  },
  hours: {
    en: 'hours',
    zh: '小时',
  },
  o3UnstakeTip: {
    en: 'Available around July 29, 2021',
    zh: '2021/7/29 左右开放',
  },
};

export default vault;

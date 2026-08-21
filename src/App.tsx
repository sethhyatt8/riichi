import { useState } from 'react'
import './App.css'

type SeatIndex = 0 | 1 | 2 | 3
type WinType = 'ron' | 'tsumo'
type WaitType = 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon'

type RoundWind = 'E' | 'S' | 'W' | 'N'

type TableSnapshot = {
  scores: [number, number, number, number]
  dealer: SeatIndex
  roundWind: RoundWind
  handNumber: 1 | 2 | 3 | 4
  honba: number
  riichiPot: number
  riichiThisHand: [boolean, boolean, boolean, boolean]
}

type YakumanId =
  | 'kokushi'
  | 'suuankou'
  | 'daisangen'
  | 'shousuushii'
  | 'daisuushii'
  | 'tsuuiisou'
  | 'chinroutou'
  | 'ryuuiisou'
  | 'chuuren'
  | 'suukantsu'
  | 'tenhou'
  | 'chiihou'
  | 'kokushi_13'
  | 'suuankou_tanki'
  | 'chuuren_9'

type HandInput = {
  winner: SeatIndex
  winType: WinType
  discarder?: SeatIndex
  han: number
  fu: number
  isDealerWin: boolean
  honba: number
  riichiPot: number // number of 1000-point sticks currently on table
  yakumanMultiplier: number // 0 for normal hands; 1+ for (multiple) yakuman
}

function ceil100(n: number) {
  return Math.ceil(n / 100) * 100
}

function ceil10(n: number) {
  return Math.ceil(n / 10) * 10
}

function calcBasePoints(han: number, fu: number, yakumanMultiplier: number) {
  if (yakumanMultiplier > 0) return 8000 * yakumanMultiplier

  // Kazoe yakuman (13+ han) – handled as yakuman equivalent.
  if (han >= 13) return 8000

  if (han >= 11) return 6000 // sanbaiman (11-12 han)
  if (han >= 8) return 4000 // baiman (8-10 han)
  if (han >= 6) return 3000 // haneman (6-7 han)
  if (han >= 5 || (han === 4 && fu >= 40) || (han === 3 && fu >= 70)) return 2000

  // Normal hand: fu * 2^(han+2)
  return fu * 2 ** (han + 2)
}

function getLimitLabel(han: number, fu: number, yakumanMultiplier: number) {
  if (yakumanMultiplier > 0) return yakumanMultiplier === 1 ? 'Yakuman' : `${yakumanMultiplier}x Yakuman`
  if (han >= 13) return 'Yakuman'
  if (han >= 11) return 'Sanbaiman'
  if (han >= 8) return 'Baiman'
  if (han >= 6) return 'Haneman'
  if (han >= 5 || (han === 4 && fu >= 40) || (han === 3 && fu >= 70)) return 'Mangan'
  return null
}

function calcPayments(input: HandInput) {
  const base = calcBasePoints(input.han, input.fu, input.yakumanMultiplier)

  if (input.winType === 'ron') {
    const points = input.isDealerWin ? ceil100(base * 6) : ceil100(base * 4)
    const honbaBonus = input.honba * 300
    const riichiBonus = input.riichiPot * 1000
    const total = points + honbaBonus + riichiBonus

    return {
      kind: 'ron' as const,
      points,
      honbaBonus,
      riichiBonus,
      total,
    }
  }

  // tsumo
  const honbaEach = input.honba * 100
  const riichiBonus = input.riichiPot * 1000

  if (input.isDealerWin) {
    const each = ceil100(base * 2) + honbaEach
    const total = each * 3 + riichiBonus
    return {
      kind: 'tsumo' as const,
      fromNonDealers: each,
      fromDealer: null as number | null,
      honbaEach,
      riichiBonus,
      total,
    }
  }

  const fromNonDealer = ceil100(base * 1) + honbaEach
  const fromDealer = ceil100(base * 2) + honbaEach
  const total = fromDealer + fromNonDealer * 2 + riichiBonus
  return {
    kind: 'tsumo' as const,
    fromNonDealers: fromNonDealer,
    fromDealer,
    honbaEach,
    riichiBonus,
    total,
  }
}

function nextRoundWind(w: RoundWind): RoundWind {
  if (w === 'E') return 'S'
  if (w === 'S') return 'W'
  if (w === 'W') return 'N'
  return 'E'
}

function formatRound(w: RoundWind, hand: 1 | 2 | 3 | 4) {
  const name = w === 'E' ? 'EAST' : w === 'S' ? 'SOUTH' : w === 'W' ? 'WEST' : 'NORTH'
  return `${name} ${hand}`
}

function rotateDealer(
  dealer: SeatIndex,
  roundWind: RoundWind,
  handNumber: 1 | 2 | 3 | 4,
) {
  const nextDealer = ((dealer + 1) % 4) as SeatIndex
  if (handNumber < 4) {
    return { dealer: nextDealer, roundWind, handNumber: (handNumber + 1) as 1 | 2 | 3 | 4 }
  }
  return { dealer: nextDealer, roundWind: nextRoundWind(roundWind), handNumber: 1 as const }
}

function formatPoints(n: number) {
  return n.toLocaleString('en-US')
}

function waitFu(wait: WaitType) {
  if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') return 2
  return 0
}

const windsByOffset: RoundWind[] = ['E', 'S', 'W', 'N']

const yakumanOptions: Array<{ id: YakumanId; label: string; value: 1 | 2 }> = [
  { id: 'kokushi', label: 'Kokushi musou (Thirteen Orphans)', value: 1 },
  { id: 'kokushi_13', label: 'Kokushi musou 13-wait (double)', value: 2 },
  { id: 'suuankou', label: 'Suuankou (Four concealed triplets)', value: 1 },
  { id: 'suuankou_tanki', label: 'Suuankou tanki (double)', value: 2 },
  { id: 'daisangen', label: 'Daisangen (Big Three Dragons)', value: 1 },
  { id: 'shousuushii', label: 'Shousuushii (Little Four Winds)', value: 1 },
  { id: 'daisuushii', label: 'Daisuushii (Big Four Winds)', value: 2 },
  { id: 'tsuuiisou', label: 'Tsuuiisou (All Honors)', value: 1 },
  { id: 'chinroutou', label: 'Chinroutou (All Terminals)', value: 1 },
  { id: 'ryuuiisou', label: 'Ryuuiisou (All Green)', value: 1 },
  { id: 'chuuren', label: 'Chuuren poutou (Nine Gates)', value: 1 },
  { id: 'chuuren_9', label: 'Chuuren poutou 9-wait (double)', value: 2 },
  { id: 'suukantsu', label: 'Suukantsu (Four Kans)', value: 1 },
  { id: 'tenhou', label: 'Tenhou (Blessing of Heaven)', value: 1 },
  { id: 'chiihou', label: 'Chiihou (Blessing of Earth)', value: 1 },
]

function App() {
  // table state
  const [scores, setScores] = useState<[number, number, number, number]>([
    25000, 25000, 25000, 25000,
  ])
  const [playerNames, setPlayerNames] = useState<[string, string, string, string]>([
    'Player 1', 'Player 2', 'Player 3', 'Player 4',
  ])
  const [dealer, setDealer] = useState<SeatIndex>(0)
  const [roundWind, setRoundWind] = useState<RoundWind>('E')
  const [handNumber, setHandNumber] = useState<1 | 2 | 3 | 4>(1)
  const [honba, setHonba] = useState(0)
  const [riichiPot, setRiichiPot] = useState(0)
  const [history, setHistory] = useState<TableSnapshot[]>([])
  const [riichiNewThisScore, setRiichiNewThisScore] = useState<[boolean, boolean, boolean, boolean]>([
    false, false, false, false,
  ])
  const [riichiThisHand, setRiichiThisHand] = useState<[boolean, boolean, boolean, boolean]>([
    false, false, false, false,
  ])
  const [gameStarted, setGameStarted] = useState(false)
  const [guideText, setGuideText] = useState('Start a hanchan at East 1.')

  const [isNamesModalOpen, setIsNamesModalOpen] = useState(false)
  const [namesDraft, setNamesDraft] = useState<[string, string, string, string]>([
    'Player 1', 'Player 2', 'Player 3', 'Player 4',
  ])

  // draw (exhaustive) modal
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false)
  const [tenpaiSeats, setTenpaiSeats] = useState<[boolean, boolean, boolean, boolean]>([
    false, false, false, false,
  ])

  // modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [winner, setWinner] = useState<SeatIndex>(0)
  const [winType, setWinType] = useState<WinType>('ron')
  const [discarder, setDiscarder] = useState<SeatIndex>(1)
  const [han, setHan] = useState(3)
  const [fu, setFu] = useState(30)
  const [yakumanSelected, setYakumanSelected] = useState<Record<YakumanId, boolean>>(() => {
    const init: Partial<Record<YakumanId, boolean>> = {}
    for (const opt of yakumanOptions) init[opt.id] = false
    return init as Record<YakumanId, boolean>
  })

  // questionnaire state
  const [useQuestionnaire, setUseQuestionnaire] = useState(true)
  const [isClosed, setIsClosed] = useState(true)

  // yaku (checkboxes) + dora
  const [yRiichi, setYRiichi] = useState(false)
  const [yDoubleRiichi, setYDoubleRiichi] = useState(false)
  const [yIppatsu, setYIppatsu] = useState(false)
  const [yMenzenTsumo, setYMenzenTsumo] = useState(false)
  const [yPinfu, setYPinfu] = useState(false)
  const [yTanyao, setYTanyao] = useState(false)
  const [yYakuhaiTriplets, setYYakuhaiTriplets] = useState(0) // each = 1 han
  const [yToitoi, setYToitoi] = useState(false)
  const [ySanshokuDoujun, setYSanshokuDoujun] = useState(false) // 2 closed / 1 open
  const [yIttsu, setYIttsu] = useState(false) // 2 closed / 1 open
  const [yChanta, setYChanta] = useState(false) // 2 closed / 1 open
  const [yJunchan, setYJunchan] = useState(false) // 3 closed / 2 open
  const [yHonitsu, setYHonitsu] = useState(false) // 3 closed / 2 open
  const [yChinitsu, setYChinitsu] = useState(false) // 6 closed / 5 open
  const [dora, setDora] = useState(0)
  const [uraDora, setUraDora] = useState(0)
  const [akaDora, setAkaDora] = useState(0)

  // fu
  const [fuChiitoitsu, setFuChiitoitsu] = useState(false)
  const [fuWait, setFuWait] = useState<WaitType>('ryanmen')
  const [fuYakuhaiPair, setFuYakuhaiPair] = useState(false)
  const [fuDoubleWindPairValue, setFuDoubleWindPairValue] = useState<2 | 4>(2)
  const [fuIsDoubleWindPair, setFuIsDoubleWindPair] = useState(false)
  const [fuOpenTripletSimple, setFuOpenTripletSimple] = useState(0)
  const [fuOpenTripletTermHonor, setFuOpenTripletTermHonor] = useState(0)
  const [fuClosedTripletSimple, setFuClosedTripletSimple] = useState(0)
  const [fuClosedTripletTermHonor, setFuClosedTripletTermHonor] = useState(0)
  const [fuOpenKanSimple, setFuOpenKanSimple] = useState(0)
  const [fuOpenKanTermHonor, setFuOpenKanTermHonor] = useState(0)
  const [fuClosedKanSimple, setFuClosedKanSimple] = useState(0)
  const [fuClosedKanTermHonor, setFuClosedKanTermHonor] = useState(0)

  const openScoreHand = () => {
    setWinner(dealer)
    setWinType('ron')
    setDiscarder(((dealer + 1) % 4) as SeatIndex)
    setHan(3)
    setFu(30)
    setYakumanSelected(() => {
      const init: Partial<Record<YakumanId, boolean>> = {}
      for (const opt of yakumanOptions) init[opt.id] = false
      return init as Record<YakumanId, boolean>
    })
    setUseQuestionnaire(true)
    setIsClosed(true)

    // reset questionnaire defaults
    setYRiichi(false)
    setYDoubleRiichi(false)
    setYIppatsu(false)
    setYMenzenTsumo(false)
    setYPinfu(false)
    setYTanyao(false)
    setYYakuhaiTriplets(0)
    setYToitoi(false)
    setYSanshokuDoujun(false)
    setYIttsu(false)
    setYChanta(false)
    setYJunchan(false)
    setYHonitsu(false)
    setYChinitsu(false)
    setDora(0)
    setUraDora(0)
    setAkaDora(0)

    setFuChiitoitsu(false)
    setFuWait('ryanmen')
    setFuYakuhaiPair(false)
    setFuIsDoubleWindPair(false)
    setFuDoubleWindPairValue(2)
    setFuOpenTripletSimple(0)
    setFuOpenTripletTermHonor(0)
    setFuClosedTripletSimple(0)
    setFuClosedTripletTermHonor(0)
    setFuOpenKanSimple(0)
    setFuOpenKanTermHonor(0)
    setFuClosedKanSimple(0)
    setFuClosedKanTermHonor(0)

    setRiichiNewThisScore([...riichiThisHand] as [boolean, boolean, boolean, boolean])
    setYRiichi(riichiThisHand[dealer])
    setIsModalOpen(true)
  }

  const yakumanMultiplier = yakumanOptions.reduce((sum, opt) => sum + (yakumanSelected[opt.id] ? opt.value : 0), 0)

  const pushHistory = () => {
    const snap: TableSnapshot = {
      scores: [...scores] as [number, number, number, number],
      dealer,
      roundWind,
      handNumber,
      honba,
      riichiPot,
      riichiThisHand: [...riichiThisHand] as [boolean, boolean, boolean, boolean],
    }
    setHistory((h) => [...h, snap])
  }

  const undo = () => {
    setHistory((h) => {
      const last = h.at(-1)
      if (!last) return h
      setScores(last.scores)
      setDealer(last.dealer)
      setRoundWind(last.roundWind)
      setHandNumber(last.handNumber)
      setHonba(last.honba)
      setRiichiPot(last.riichiPot)
      setRiichiThisHand(last.riichiThisHand)
      setGuideText('Undid the last change.')
      return h.slice(0, -1)
    })
  }

  const leftoverRiichi = Math.max(0, riichiPot - riichiThisHand.filter(Boolean).length)

  const toggleRiichi = (seat: SeatIndex) => {
    if (riichiThisHand[seat]) {
      pushHistory()
      setRiichiThisHand((prev) => {
        const next = [...prev] as [boolean, boolean, boolean, boolean]
        next[seat] = false
        return next
      })
      setRiichiPot((p) => Math.max(0, p - 1))
      setScores((prev) => {
        const next = [...prev] as [number, number, number, number]
        next[seat] += 1000
        return next
      })
      return
    }
    pushHistory()
    setRiichiThisHand((prev) => {
      const next = [...prev] as [boolean, boolean, boolean, boolean]
      next[seat] = true
      return next
    })
    setRiichiPot((p) => p + 1)
    setScores((prev) => {
      const next = [...prev] as [number, number, number, number]
      next[seat] -= 1000
      return next
    })
  }

  const startEast1 = () => {
    const cleaned = namesDraft.map((n, idx) => (n.trim() ? n.trim() : `Player ${idx + 1}`)) as [
      string,
      string,
      string,
      string,
    ]
    setPlayerNames(cleaned)
    setScores([25000, 25000, 25000, 25000])
    setDealer(0)
    setRoundWind('E')
    setHandNumber(1)
    setHonba(0)
    setRiichiPot(0)
    setRiichiThisHand([false, false, false, false])
    setHistory([])
    setGameStarted(true)
    setGuideText(`East 1. ${cleaned[0]} is dealer. Tap Riichi on a seat when they declare, then score the hand.`)
  }

  const openNames = () => {
    setNamesDraft(playerNames)
    setIsNamesModalOpen(true)
  }

  const applyNames = () => {
    const cleaned = namesDraft.map((n, idx) => (n.trim() ? n.trim() : `Player ${idx + 1}`)) as [
      string,
      string,
      string,
      string,
    ]
    setPlayerNames(cleaned)
    setIsNamesModalOpen(false)
  }

  const openExhaustiveDraw = () => {
    setTenpaiSeats([...riichiThisHand] as [boolean, boolean, boolean, boolean])
    setIsDrawModalOpen(true)
  }

  const applyExhaustiveDraw = () => {
    pushHistory()
    // Noten payments: 3000 points exchanged between tenpai/noten
    // - If 1 tenpai: +3000, each noten -1000
    // - If 2 tenpai: each +1500, each noten -1500
    // - If 3 tenpai: each +1000, noten -3000
    const tenpaiCount = tenpaiSeats.filter(Boolean).length
    const notenCount = 4 - tenpaiCount

    if (tenpaiCount > 0 && tenpaiCount < 4) {
      const total = 3000
      const gainEach = Math.floor(total / tenpaiCount)
      const lossEach = Math.floor(total / notenCount)

      setScores((prev) => {
        const next = [...prev] as [number, number, number, number]
        for (let i = 0; i < 4; i++) {
          const seat = i as SeatIndex
          if (tenpaiSeats[seat]) next[seat] += gainEach
          else next[seat] -= lossEach
        }
        return next
      })
    }

    // After exhaustive draw: honba increases; leftover riichi sticks stay on the table.
    setHonba((h) => h + 1)
    setRiichiThisHand([false, false, false, false])

    // Dealer repeat if dealer is tenpai, else dealer rotates (and hand number advances)
    const dealerInTenpai = tenpaiSeats[dealer]
    if (dealerInTenpai) {
      setGuideText(
        `${formatRound(roundWind, handNumber)} continues — dealer tenpai. Honba ${honba + 1}. ${riichiPot} leftover riichi stick${riichiPot === 1 ? '' : 's'} stay in the pot.`,
      )
    } else {
      const next = rotateDealer(dealer, roundWind, handNumber)
      setDealer(next.dealer)
      setRoundWind(next.roundWind)
      setHandNumber(next.handNumber)
      setGuideText(
        `${formatRound(next.roundWind, next.handNumber)}. Honba ${honba + 1}. ${riichiPot} leftover riichi stick${riichiPot === 1 ? '' : 's'} stay in the pot.`,
      )
    }

    setIsDrawModalOpen(false)
  }

  const applyHand = () => {
    pushHistory()
    const isDealerWin = winner === dealer
    const effectiveHan = yakumanMultiplier > 0 ? 0 : (useQuestionnaire ? derived.han : han)
    const effectiveFu = yakumanMultiplier > 0 ? 0 : (useQuestionnaire ? derived.fu : fu)
    const newlyDeclared = ([0, 1, 2, 3] as const).filter((i) => riichiNewThisScore[i] && !riichiThisHand[i]).length
    const undeclared = ([0, 1, 2, 3] as const).filter((i) => !riichiNewThisScore[i] && riichiThisHand[i]).length
    const effectiveRiichiPot = riichiPot + newlyDeclared - undeclared
    const input: HandInput = {
      winner,
      winType,
      discarder: winType === 'ron' ? discarder : undefined,
      han: effectiveHan,
      fu: effectiveFu,
      yakumanMultiplier,
      isDealerWin,
      honba,
      riichiPot: effectiveRiichiPot,
    }

    const payments = calcPayments(input)

    setScores((prev) => {
      const next = [...prev] as [number, number, number, number]

      // Collect any riichi not already paid from the table buttons
      for (let i = 0; i < 4; i++) {
        const seat = i as SeatIndex
        if (riichiNewThisScore[seat] && !riichiThisHand[seat]) next[seat] -= 1000
        if (!riichiNewThisScore[seat] && riichiThisHand[seat]) next[seat] += 1000
      }

      if (payments.kind === 'ron') {
        const d = discarder
        if (d === winner) return prev
        next[winner] += payments.points + payments.honbaBonus + payments.riichiBonus
        next[d] -= payments.points + payments.honbaBonus
        return next
      }

      // tsumo
      for (let i = 0; i < 4; i++) {
        if (i === winner) continue
        const seat = i as SeatIndex
        if (isDealerWin) {
          next[seat] -= payments.fromNonDealers
          next[winner] += payments.fromNonDealers
        } else {
          const pay = seat === dealer ? (payments.fromDealer ?? 0) : payments.fromNonDealers
          next[seat] -= pay
          next[winner] += pay
        }
      }

      next[winner] += payments.riichiBonus
      return next
    })

    // Winner takes leftover riichi sticks plus this hand's deposits
    setRiichiPot(0)
    setRiichiThisHand([false, false, false, false])
    setRiichiNewThisScore([false, false, false, false])

    // dealer / honba / round progression (per standard honba rules)
    if (isDealerWin) {
      setHonba((h) => h + 1)
      setGuideText(
        `${playerNames[winner]} won ${formatRound(roundWind, handNumber)}. Dealer repeat, honba ${honba + 1}. Riichi pot is empty.`,
      )
    } else {
      setHonba(0)
      const next = rotateDealer(dealer, roundWind, handNumber)
      setDealer(next.dealer)
      setRoundWind(next.roundWind)
      setHandNumber(next.handNumber)
      setGuideText(
        `${playerNames[winner]} won. Next is ${formatRound(next.roundWind, next.handNumber)}. Honba cleared. ${playerNames[next.dealer]} is dealer.`,
      )
    }

    setIsModalOpen(false)
  }

  const derived = (() => {
    if (!useQuestionnaire) return { han, fu, fuBreakdown: [] as Array<{ label: string; value: number }> }

    // ----- HAN -----
    const baseYakuHan: Array<{ label: string; value: number }> = []

    if (yDoubleRiichi) baseYakuHan.push({ label: 'Double riichi', value: 2 })
    else if (yRiichi) baseYakuHan.push({ label: 'Riichi', value: 1 })

    if ((yRiichi || yDoubleRiichi) && yIppatsu) baseYakuHan.push({ label: 'Ippatsu', value: 1 })

    if (isClosed && winType === 'tsumo' && yMenzenTsumo) baseYakuHan.push({ label: 'Menzen tsumo', value: 1 })

    if (isClosed && yPinfu) baseYakuHan.push({ label: 'Pinfu', value: 1 })

    if (yTanyao) baseYakuHan.push({ label: 'Tanyao', value: 1 })

    if (yYakuhaiTriplets > 0) baseYakuHan.push({ label: `Yakuhai x${yYakuhaiTriplets}`, value: yYakuhaiTriplets })

    if (yToitoi) baseYakuHan.push({ label: 'Toitoi', value: 2 })

    if (ySanshokuDoujun) baseYakuHan.push({ label: 'Sanshoku doujun', value: isClosed ? 2 : 1 })
    if (yIttsu) baseYakuHan.push({ label: 'Ittsu', value: isClosed ? 2 : 1 })
    if (yChanta) baseYakuHan.push({ label: 'Chanta', value: isClosed ? 2 : 1 })
    if (yJunchan) baseYakuHan.push({ label: 'Junchan', value: isClosed ? 3 : 2 })
    if (yHonitsu) baseYakuHan.push({ label: 'Honitsu', value: isClosed ? 3 : 2 })
    if (yChinitsu) baseYakuHan.push({ label: 'Chinitsu', value: isClosed ? 6 : 5 })

    const doraHan = Math.max(0, dora) + Math.max(0, uraDora) + Math.max(0, akaDora)
    const hanTotal = baseYakuHan.reduce((sum, x) => sum + x.value, 0) + doraHan

    // ----- FU -----
    const fuParts: Array<{ label: string; value: number }> = []
    if (fuChiitoitsu) {
      return { han: hanTotal, fu: 25, fuBreakdown: [{ label: 'Chiitoitsu', value: 25 }] }
    }

    fuParts.push({ label: 'Base', value: 20 })

    // Closed ron +10
    if (isClosed && winType === 'ron') fuParts.push({ label: 'Menzen ron', value: 10 })

    // Meld fu
    const meldFuTotal =
      fuOpenTripletSimple * 2 +
      fuOpenTripletTermHonor * 4 +
      fuClosedTripletSimple * 4 +
      fuClosedTripletTermHonor * 8 +
      fuOpenKanSimple * 8 +
      fuOpenKanTermHonor * 16 +
      fuClosedKanSimple * 16 +
      fuClosedKanTermHonor * 32
    if (meldFuTotal) fuParts.push({ label: 'Melds', value: meldFuTotal })

    // Pair fu
    if (fuYakuhaiPair) fuParts.push({ label: 'Yakuhai pair', value: 2 })
    if (fuIsDoubleWindPair) fuParts.push({ label: 'Double-wind pair', value: fuDoubleWindPairValue })

    // Wait fu
    const wait = isClosed && yPinfu ? 'ryanmen' : fuWait
    const wfu = waitFu(wait)
    if (wfu) fuParts.push({ label: 'Wait', value: wfu })

    // Tsumo +2 fu (waived for pinfu)
    if (winType === 'tsumo' && !(isClosed && yPinfu)) fuParts.push({ label: 'Tsumo', value: 2 })

    let fuRaw = fuParts.reduce((sum, x) => sum + x.value, 0)

    // Open pinfu special case: if open and no fu beyond base 20, set to 30
    if (!isClosed && fuRaw === 20) fuRaw = 30

    const fuRounded = ceil10(fuRaw)

    return { han: hanTotal, fu: fuRounded, fuBreakdown: fuParts }
  })()

  const preview = (() => {
    const isDealerWin = winner === dealer
    const effectiveHan = yakumanMultiplier > 0 ? 0 : (useQuestionnaire ? derived.han : han)
    const effectiveFu = yakumanMultiplier > 0 ? 0 : (useQuestionnaire ? derived.fu : fu)
    const newlyDeclared = ([0, 1, 2, 3] as const).filter((i) => riichiNewThisScore[i] && !riichiThisHand[i]).length
    const undeclared = ([0, 1, 2, 3] as const).filter((i) => !riichiNewThisScore[i] && riichiThisHand[i]).length
    const effectiveRiichiPot = riichiPot + newlyDeclared - undeclared
    const leftoverSticks = Math.max(0, effectiveRiichiPot - riichiNewThisScore.filter(Boolean).length)
    const input: HandInput = {
      winner,
      winType,
      discarder: winType === 'ron' ? discarder : undefined,
      han: effectiveHan,
      fu: effectiveFu,
      yakumanMultiplier,
      isDealerWin,
      honba,
      riichiPot: effectiveRiichiPot,
    }
    return {
      payments: calcPayments(input),
      limit: getLimitLabel(effectiveHan, effectiveFu, yakumanMultiplier),
      effectiveHan,
      effectiveFu,
      leftoverSticks,
      thisHandSticks: riichiNewThisScore.filter(Boolean).length,
      effectiveRiichiPot,
    }
  })()

  return (
    <>
      <section className="soloScreen">
        <div className="tableSquare" role="presentation" aria-label="Mahjong table">
          <div className="tableGrid" aria-label="Table status">
            {(() => {
              // Position mapping (clockwise): bottom, right, top, left
              const bottom: SeatIndex = 0
              const right: SeatIndex = 1
              const top: SeatIndex = 2
              const left: SeatIndex = 3

              const seatWind = (seat: SeatIndex) => windsByOffset[(seat - dealer + 4) % 4] ?? 'E'
              const isDealerSeat = (seat: SeatIndex) => seat === dealer

              const renderSeat = (seat: SeatIndex, position: string) => (
                <div
                  className={`seatPanel ${position} ${isDealerSeat(seat) ? 'dealer' : ''} ${riichiThisHand[seat] ? 'riichiOn' : ''}`}
                >
                  <div className="seatPanelInner">
                    <div className="seatName">{playerNames[seat]}</div>
                    <div className="seatMeta">
                      <span className="seatWind">{seatWind(seat)}</span>
                      {isDealerSeat(seat) ? <span className="dealerTag">Dealer</span> : null}
                    </div>
                    <div className="seatPoints">{formatPoints(scores[seat])}</div>
                    <button
                      type="button"
                      className={`riichiCall ${riichiThisHand[seat] ? 'on' : ''}`}
                      disabled={!gameStarted}
                      onClick={() => toggleRiichi(seat)}
                    >
                      {riichiThisHand[seat] ? 'Riichi' : 'Riichi'}
                    </button>
                  </div>
                </div>
              )

              return (
                <>
                  {renderSeat(top, 'top')}
                  {renderSeat(left, 'left')}
                  <div className="tableCenter">
                    <div className="roundBadge">
                      <div className="roundBig">{formatRound(roundWind, handNumber)}</div>
                      <div className="roundSmall">Dealer: {playerNames[dealer]}</div>
                    </div>
                    <div className="tableCounters">
                      <div className="counterChip">Honba {honba}</div>
                      <div className="counterChip">
                        Riichi {riichiPot}
                        {leftoverRiichi > 0 ? ` (${leftoverRiichi} leftover)` : ''}
                      </div>
                    </div>
                    <p className="guideText">{guideText}</p>
                    <button className="btn primary big" onClick={openScoreHand} disabled={!gameStarted}>
                      Score hand
                    </button>
                    <div className="tableActions">
                      <button className="btn" onClick={openExhaustiveDraw} disabled={!gameStarted}>
                        Exhaustive draw
                      </button>
                      <button className="btn" onClick={undo} disabled={history.length === 0}>
                        Undo
                      </button>
                      <button className="btn" onClick={openNames}>
                        Names
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          setNamesDraft(playerNames)
                          setGameStarted(false)
                        }}
                      >
                        New game
                      </button>
                    </div>
                  </div>
                  {renderSeat(right, 'right')}
                  {renderSeat(bottom, 'bottom')}
                </>
              )
            })()}
          </div>
        </div>
      </section>

      {!gameStarted ? (
        <div className="setupOverlay">
          <div className="setupCard">
            <div className="setupTitle">Riichi Scorer</div>
            <p className="setupLead">
              A four-player hanchan starts at East 1. Bottom seat is the first dealer. Enter names, then we&apos;ll keep
              honba and leftover riichi sticks as you go.
            </p>
            <div className="setupFields">
              {(['Bottom', 'Right', 'Top', 'Left'] as const).map((place, idx) => (
                <label key={place} className="field">
                  <span>
                    {place}
                    {idx === 0 ? ' (first dealer)' : ''}
                  </span>
                  <input
                    type="text"
                    value={namesDraft[idx]}
                    onChange={(e) => {
                      const v = e.target.value
                      setNamesDraft((prev) => {
                        const next = [...prev] as [string, string, string, string]
                        next[idx] = v
                        return next
                      })
                    }}
                  />
                </label>
              ))}
            </div>
            <button className="btn primary big" onClick={startEast1}>
              Start East 1
            </button>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div
          className="modalBackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Score a hand">
            <div className="modalHeader">
              <div>
                <div className="modalTitle">Score a hand</div>
                <div className="modalSub">
                  {formatRound(roundWind, handNumber)} • {playerNames[dealer]} dealer • Honba {honba} • Riichi pot {riichiPot}
                </div>
              </div>
              <div className="modalHeaderActions">
                <button className="btn" onClick={() => setIsModalOpen(false)}>
                  Back to table
                </button>
                <button className="iconBtn" onClick={() => setIsModalOpen(false)} aria-label="Close">
                  ×
                </button>
              </div>
            </div>

            <div className="modalBody">
              <div className="modalCol modalColLeft">
                <div className="formGrid">
                  <label className="field checkboxField">
                    <span>Use questionnaire</span>
                    <input
                      type="checkbox"
                      checked={useQuestionnaire}
                      onChange={(e) => setUseQuestionnaire(e.target.checked)}
                    />
                  </label>

                  <label className="field checkboxField">
                    <span>Closed hand (menzen)</span>
                    <input
                      type="checkbox"
                      checked={isClosed}
                      onChange={(e) => {
                        const next = e.target.checked
                        setIsClosed(next)
                        if (!next) {
                          setYPinfu(false)
                          setYMenzenTsumo(false)
                          setYRiichi(false)
                          setYDoubleRiichi(false)
                          setYIppatsu(false)
                          setUraDora(0)
                        }
                      }}
                    />
                  </label>

                  <label className="field">
                    <span>Winner</span>
                    <select value={winner} onChange={(e) => setWinner(Number(e.target.value) as SeatIndex)}>
                      <option value={0}>{playerNames[0]}</option>
                      <option value={1}>{playerNames[1]}</option>
                      <option value={2}>{playerNames[2]}</option>
                      <option value={3}>{playerNames[3]}</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Win type</span>
                    <select value={winType} onChange={(e) => setWinType(e.target.value as WinType)}>
                      <option value="ron">Ron</option>
                      <option value="tsumo">Tsumo</option>
                    </select>
                  </label>

                  {winType === 'ron' ? (
                    <label className="field">
                      <span>Discarder</span>
                      <select
                        value={discarder}
                        onChange={(e) => setDiscarder(Number(e.target.value) as SeatIndex)}
                      >
                        <option value={0}>{playerNames[0]}</option>
                        <option value={1}>{playerNames[1]}</option>
                        <option value={2}>{playerNames[2]}</option>
                        <option value={3}>{playerNames[3]}</option>
                      </select>
                    </label>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="riichiSection">
                  <div className="qTitle">Riichi deposits (optional)</div>
                  <div className="qHint">
                    Seats already marked on the table are checked. Honba and leftover sticks from earlier hands are included in the winner total.
                  </div>
                  <div className="qGrid">
                    {(Array.from({ length: 4 }) as unknown[]).map((_, idx) => {
                      const seat = idx as SeatIndex
                      return (
                        <label key={seat} className="qCheck">
                          <input
                            type="checkbox"
                            checked={riichiNewThisScore[seat]}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setRiichiNewThisScore((prev) => {
                                const next = [...prev] as [boolean, boolean, boolean, boolean]
                                next[seat] = checked
                                return next
                              })
                            }}
                          />
                          <span>{playerNames[seat]} paid riichi (-1000)</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="preview previewCompact">
                  <div className="previewTitle">Preview</div>
                  <div className="previewLines">
                    {preview.limit ? <div className="previewLine">{preview.limit}</div> : null}
                    <div className="previewLine">
                      {yakumanMultiplier > 0 ? (
                        <>
                          <b>{yakumanMultiplier}×</b> yakuman
                        </>
                      ) : useQuestionnaire ? (
                        <>Han / fu from checklist</>
                      ) : (
                        <>
                          {preview.effectiveHan} han / {preview.effectiveFu} fu
                        </>
                      )}
                    </div>
                    <div className="previewLine">Honba {honba}: {preview.payments.kind === 'ron' ? `+${honba * 300}` : `+${honba * 100} each`}</div>
                    <div className="previewLine">
                      Riichi sticks: {preview.effectiveRiichiPot} × 1000
                      {preview.leftoverSticks ? ` (${preview.leftoverSticks} leftover + ${preview.thisHandSticks} this hand)` : ''}
                    </div>
                    <div className="previewLine">Winner total: {formatPoints(preview.payments.total)}</div>
                  </div>
                </div>

                {useQuestionnaire ? (
                  <div className="questionnaire">
                    <div className="qSection">
                      <div className="qTitle">Han (yaku + dora)</div>
                      <div className="qGrid">
                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={!isClosed}
                            checked={yRiichi}
                            onChange={(e) => {
                              setYRiichi(e.target.checked)
                              if (e.target.checked) setYDoubleRiichi(false)
                              if (!e.target.checked) setYIppatsu(false)
                            }}
                          />
                          <span>Riichi (1) — closed tenpai bet</span>
                        </label>
                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={!isClosed}
                            checked={yDoubleRiichi}
                            onChange={(e) => {
                              setYDoubleRiichi(e.target.checked)
                              if (e.target.checked) setYRiichi(false)
                              if (!e.target.checked) setYIppatsu(false)
                            }}
                          />
                          <span>Double riichi (2) — riichi on first turn</span>
                        </label>
                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={!(isClosed && (yRiichi || yDoubleRiichi))}
                            checked={yIppatsu}
                            onChange={(e) => setYIppatsu(e.target.checked)}
                          />
                          <span>Ippatsu (1) — win before next discard</span>
                        </label>
                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={!(isClosed && winType === 'tsumo')}
                            checked={yMenzenTsumo}
                            onChange={(e) => setYMenzenTsumo(e.target.checked)}
                          />
                          <span>Menzen tsumo (1) — self-draw while closed</span>
                        </label>
                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={!isClosed}
                            checked={yPinfu}
                            onChange={(e) => {
                              setYPinfu(e.target.checked)
                              if (e.target.checked) {
                                setFuYakuhaiPair(false)
                                setFuIsDoubleWindPair(false)
                                setFuWait('ryanmen')
                                setFuOpenTripletSimple(0)
                                setFuOpenTripletTermHonor(0)
                                setFuClosedTripletSimple(0)
                                setFuClosedTripletTermHonor(0)
                                setFuOpenKanSimple(0)
                                setFuOpenKanTermHonor(0)
                                setFuClosedKanSimple(0)
                                setFuClosedKanTermHonor(0)
                              }
                            }}
                          />
                          <span>Pinfu (1) — all sequences, no fu</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yTanyao} onChange={(e) => setYTanyao(e.target.checked)} />
                          <span>Tanyao (1) — no terminals/honors</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yToitoi} onChange={(e) => setYToitoi(e.target.checked)} />
                          <span>Toitoi (2) — all triplets</span>
                        </label>
                        <label className="qCheck">
                          <input
                            type="checkbox"
                            checked={ySanshokuDoujun}
                            onChange={(e) => setYSanshokuDoujun(e.target.checked)}
                          />
                          <span>Sanshoku doujun ({isClosed ? 2 : 1}) — same seq 3 suits</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yIttsu} onChange={(e) => setYIttsu(e.target.checked)} />
                          <span>Ittsu ({isClosed ? 2 : 1}) — 123/456/789 same suit</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yChanta} onChange={(e) => setYChanta(e.target.checked)} />
                          <span>Chanta ({isClosed ? 2 : 1}) — each set has terminal/honor</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yJunchan} onChange={(e) => setYJunchan(e.target.checked)} />
                          <span>Junchan ({isClosed ? 3 : 2}) — chanta without honors</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yHonitsu} onChange={(e) => setYHonitsu(e.target.checked)} />
                          <span>Honitsu ({isClosed ? 3 : 2}) — 1 suit + honors</span>
                        </label>
                        <label className="qCheck">
                          <input type="checkbox" checked={yChinitsu} onChange={(e) => setYChinitsu(e.target.checked)} />
                          <span>Chinitsu ({isClosed ? 6 : 5}) — 1 suit only</span>
                        </label>
                      </div>

                      <div className="qNumbers">
                        <label className="field">
                          <span>Yakuhai triplets (each 1 han)</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={yYakuhaiTriplets}
                            onChange={(e) => setYYakuhaiTriplets(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Dora</span>
                          <input type="number" min={0} step={1} value={dora} onChange={(e) => setDora(Number(e.target.value))} />
                        </label>
                        <label className="field">
                          <span>Aka dora</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={akaDora}
                            onChange={(e) => setAkaDora(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Ura dora</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={!(isClosed && (yRiichi || yDoubleRiichi))}
                            value={uraDora}
                            onChange={(e) => setUraDora(Number(e.target.value))}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="qSection">
                      <div className="qTitle">Fu</div>
                      <div className="qGrid">
                        <label className="qCheck">
                          <input type="checkbox" checked={fuChiitoitsu} onChange={(e) => setFuChiitoitsu(e.target.checked)} />
                          <span>Chiitoitsu (fixed 25 fu)</span>
                        </label>

                        <label className="field">
                          <span>Wait</span>
                          <select
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={(isClosed && yPinfu) ? 'ryanmen' : fuWait}
                            onChange={(e) => setFuWait(e.target.value as WaitType)}
                          >
                            <option value="ryanmen">Ryanmen (0)</option>
                            <option value="shanpon">Shanpon (0*)</option>
                            <option value="kanchan">Kanchan (+2)</option>
                            <option value="penchan">Penchan (+2)</option>
                            <option value="tanki">Tanki (+2)</option>
                          </select>
                        </label>

                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            checked={fuYakuhaiPair}
                            onChange={(e) => setFuYakuhaiPair(e.target.checked)}
                          />
                          <span>Yakuhai pair (+2)</span>
                        </label>

                        <label className="qCheck">
                          <input
                            type="checkbox"
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            checked={fuIsDoubleWindPair}
                            onChange={(e) => setFuIsDoubleWindPair(e.target.checked)}
                          />
                          <span>Double-wind pair</span>
                        </label>

                        <label className="field">
                          <span>Double-wind pair value</span>
                          <select
                            disabled={fuChiitoitsu || !fuIsDoubleWindPair || (isClosed && yPinfu)}
                            value={fuDoubleWindPairValue}
                            onChange={(e) => setFuDoubleWindPairValue(Number(e.target.value) as 2 | 4)}
                          >
                            <option value={2}>+2 (common)</option>
                            <option value={4}>+4 (variation)</option>
                          </select>
                        </label>
                      </div>

                      <div className="qNumbers">
                        <label className="field">
                          <span>Open triplet (simples) ×2 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuOpenTripletSimple}
                            onChange={(e) => setFuOpenTripletSimple(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Open triplet (term/honor) ×4 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuOpenTripletTermHonor}
                            onChange={(e) => setFuOpenTripletTermHonor(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Closed triplet (simples) ×4 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuClosedTripletSimple}
                            onChange={(e) => setFuClosedTripletSimple(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Closed triplet (term/honor) ×8 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuClosedTripletTermHonor}
                            onChange={(e) => setFuClosedTripletTermHonor(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Open kan (simples) ×8 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuOpenKanSimple}
                            onChange={(e) => setFuOpenKanSimple(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Open kan (term/honor) ×16 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuOpenKanTermHonor}
                            onChange={(e) => setFuOpenKanTermHonor(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Closed kan (simples) ×16 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuClosedKanSimple}
                            onChange={(e) => setFuClosedKanSimple(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Closed kan (term/honor) ×32 fu</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={fuChiitoitsu || (isClosed && yPinfu)}
                            value={fuClosedKanTermHonor}
                            onChange={(e) => setFuClosedKanTermHonor(Number(e.target.value))}
                          />
                        </label>
                      </div>

                      <div className="qHint">
                        Fu rounds up to nearest 10 (except chiitoitsu). For tsumo, +2 fu is waived for pinfu.
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="modalCol modalColRight">
                <div className="formGrid hanFuRow">
                  <label className="field">
                    <span>Han</span>
                    <input
                      type="number"
                      min={0}
                      max={13}
                      step={1}
                      disabled={yakumanMultiplier > 0 || useQuestionnaire}
                      value={useQuestionnaire ? derived.han : han}
                      onChange={(e) => setHan(Number(e.target.value))}
                    />
                  </label>

                  <label className="field">
                    <span>Fu</span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      disabled={yakumanMultiplier > 0 || useQuestionnaire}
                      value={useQuestionnaire ? derived.fu : fu}
                      onChange={(e) => setFu(Number(e.target.value))}
                    />
                  </label>
                </div>

                <div className="yakumanSection">
                  <div className="qTitle">Yakuman (rare)</div>
                  <div className="qHint">
                    Only check these if the win screen shows a yakuman name. Dora/aka/ura don’t add anything to yakuman hands.
                  </div>
                  <div className="qGrid">
                    {yakumanOptions.map((opt) => (
                      <label key={opt.id} className="qCheck">
                        <input
                          type="checkbox"
                          checked={yakumanSelected[opt.id]}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setYakumanSelected((prev) => ({ ...prev, [opt.id]: checked }))
                          }}
                        />
                        <span>
                          {opt.label} {opt.value === 2 ? '(2×)' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="qHint">
                    Total: <b>{yakumanMultiplier}</b>× yakuman {yakumanMultiplier ? '(han/fu ignored)' : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={applyHand}>
                Confirm & apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDrawModalOpen ? (
        <div
          className="modalBackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsDrawModalOpen(false)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Exhaustive draw">
            <div className="modalHeader">
              <div>
                <div className="modalTitle">Exhaustive draw</div>
                <div className="modalSub">{formatRound(roundWind, handNumber)} • Select who is in tenpai</div>
              </div>
              <div className="modalHeaderActions">
                <button className="btn" onClick={() => setIsDrawModalOpen(false)}>
                  Back to table
                </button>
                <button className="iconBtn" onClick={() => setIsDrawModalOpen(false)} aria-label="Close">
                  ×
                </button>
              </div>
            </div>

            <div className="modalBody">
              <div className="formGrid">
                {(Array.from({ length: 4 }) as unknown[]).map((_, idx) => {
                  const seat = idx as SeatIndex
                  const label = seat === dealer ? `Seat ${seat + 1} (Dealer)` : `Seat ${seat + 1}`
                  return (
                    <label key={seat} className="field checkboxField">
                      <span>{label} tenpai</span>
                      <input
                        type="checkbox"
                        checked={tenpaiSeats[seat]}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setTenpaiSeats((prev) => {
                            const next = [...prev] as [boolean, boolean, boolean, boolean]
                            next[seat] = checked
                            return next
                          })
                        }}
                      />
                    </label>
                  )
                })}
              </div>

              <div className="preview">
                <div className="previewTitle">Tenpai / Noten payments</div>
                <div className="previewLines">
                  <div className="previewLine">If not all / not none: total 3000 points exchanged.</div>
                  <div className="previewLine">Dealer repeats if dealer is tenpai.</div>
                  <div className="previewLine">
                    Honba will become {honba + 1}. {riichiPot} leftover riichi stick{riichiPot === 1 ? '' : 's'} stay on the table.
                  </div>
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button className="btn" onClick={() => setIsDrawModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={applyExhaustiveDraw}>
                Apply draw
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isNamesModalOpen ? (
        <div
          className="modalBackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsNamesModalOpen(false)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit player names">
            <div className="modalHeader">
              <div>
                <div className="modalTitle">Player names</div>
                <div className="modalSub">These labels show on the table and in the scoring forms.</div>
              </div>
              <div className="modalHeaderActions">
                <button className="btn" onClick={() => setIsNamesModalOpen(false)}>
                  Back to table
                </button>
                <button className="iconBtn" onClick={() => setIsNamesModalOpen(false)} aria-label="Close">
                  ×
                </button>
              </div>
            </div>

            <div className="modalBody">
              <div className="formGrid">
                {(Array.from({ length: 4 }) as unknown[]).map((_, idx) => {
                  const seat = idx as SeatIndex
                  return (
                    <label key={seat} className="field">
                      <span>Seat {seat + 1}</span>
                      <input
                        type="text"
                        value={namesDraft[seat]}
                        onChange={(e) => {
                          const v = e.target.value
                          setNamesDraft((prev) => {
                            const next = [...prev] as [string, string, string, string]
                            next[seat] = v
                            return next
                          })
                        }}
                      />
                    </label>
                  )
                })}
              </div>
              <div className="preview">
                <div className="previewTitle">Tip</div>
                <div className="previewLines">
                  <div className="previewLine">Leave blank to fall back to “Player X”.</div>
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button className="btn" onClick={() => setIsNamesModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={applyNames}>
                Save names
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default App

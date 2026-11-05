// Deterministic, entirely fictional prototype data. See docs/synthetic-data-assumptions.md.
export const DATA_AS_OF = '2026-11-05'

export const VACCINATION_SCHEDULE = [
  { id: 'bcg', name: 'BCG', doseNumber: 1, dueAfterDays: 0 },
  { id: 'opv-1', name: 'OPV', doseNumber: 1, dueAfterDays: 42 },
  { id: 'pentavalent-1', name: 'Pentavalent', doseNumber: 1, dueAfterDays: 42 },
  { id: 'pentavalent-2', name: 'Pentavalent', doseNumber: 2, dueAfterDays: 70 },
  { id: 'mr-1', name: 'MR', doseNumber: 1, dueAfterDays: 270 },
]

const FIRST_NAMES = ['Aarav', 'Anaya', 'Ishaan', 'Myra', 'Kabir', 'Zoya', 'Vivaan', 'Sara', 'Reyansh', 'Kiara', 'Advik', 'Aadhya']
const FAMILY_INITIALS = ['Sen', 'Kapoor', 'Rao', 'Patel', 'Nair', 'Khan', 'Das', 'Iyer', 'Bose', 'Shah']
export const LOCALITIES = ['North Ward', 'River Side', 'East Colony', 'South Market', 'Central Park', 'Lake View', 'Hill Block', 'Garden Enclave']
export const ASHA_WORKER_NAMES = ['Meena S.', 'Asha P.', 'Lata D.', 'Rekha B.', 'Rupa K.', 'Saira M.', 'Nirmala T.', 'Kavita R.', 'Farida A.', 'Sunita J.', 'Poonam C.', 'Anjali V.']
export const ASHA_WORKER_ROSTER = ASHA_WORKER_NAMES.map((name, index) => ({ workerId: `ASHA-${String(index + 1).padStart(3, '0')}`, name }))
const AS_OF = new Date(`${DATA_AS_OF}T00:00:00Z`)
const DAY_MS = 86_400_000

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS)
}

function ageOn(dateOfBirth) {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number)
  let years = AS_OF.getUTCFullYear() - birthYear
  let months = AS_OF.getUTCMonth() + 1 - birthMonth
  let days = AS_OF.getUTCDate() - birthDay

  if (days < 0) {
    months -= 1
    const daysInPreviousMonth = new Date(Date.UTC(AS_OF.getUTCFullYear(), AS_OF.getUTCMonth(), 0)).getUTCDate()
    days += daysInPreviousMonth
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const labelParts = []
  if (years) labelParts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
  if (months) labelParts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  if (days || labelParts.length === 0) labelParts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  return { years, months, days, label: labelParts.join(', ') }
}

function seededValue(index, salt) {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43_758.5453
  return value - Math.floor(value)
}

export function createChildRecord({ childId, name, dateOfBirth, registrationDate, locality, assignedAshaWorker, vaccinationHistory = [], migrationStatus = 'Resident', familyReachability = 'Reachable' }) {
  const completedHistory = vaccinationHistory
    .map((dose) => {
      const scheduleDose = VACCINATION_SCHEDULE.find((item) => item.id === dose.id)
      if (!scheduleDose) return dose
      const scheduledDate = isoDate(addDays(new Date(`${dateOfBirth}T00:00:00Z`), scheduleDose.dueAfterDays))
      return { ...dose, ...scheduleDose, scheduledDate }
    })
    .filter(({ administeredDate }) => administeredDate <= DATA_AS_OF)
  const completedIds = new Set(completedHistory.map(({ id }) => id))
  const pendingDoses = []
  const overdueDoses = []

  for (const dose of VACCINATION_SCHEDULE) {
    if (completedIds.has(dose.id)) continue
    const dueDate = isoDate(addDays(new Date(`${dateOfBirth}T00:00:00Z`), dose.dueAfterDays))
    if (dueDate >= DATA_AS_OF) {
      pendingDoses.push({ ...dose, dueDate, status: dueDate === DATA_AS_OF ? 'Due today' : 'Future dose' })
    } else {
      overdueDoses.push({ ...dose, dueDate, daysOverdue: Math.floor((AS_OF - new Date(`${dueDate}T00:00:00Z`)) / DAY_MS) })
    }
  }

  const followUpStatus = migrationStatus === 'Migrated out'
    ? 'Migrated'
    : familyReachability === 'Unreachable'
      ? 'Unreachable'
      : overdueDoses.length > 0
        ? 'Immediate follow-up'
        : pendingDoses.length > 0
          ? 'Scheduled'
          : 'Up to date'
  const ageDays = Math.floor((AS_OF - new Date(`${dateOfBirth}T00:00:00Z`)) / DAY_MS)

  return {
    childId,
    name: name.trim(),
    dateOfBirth,
    age: ageOn(dateOfBirth),
    ageDays,
    locality,
    assignedAshaWorker,
    registrationDate,
    vaccinationHistory: [...completedHistory].sort((a, b) => a.administeredDate.localeCompare(b.administeredDate)),
    completedDoses: completedHistory.map(({ id, name: doseName, doseNumber, administeredDate, administeredBy, recordedBy }) => ({ id, name: doseName, doseNumber, administeredDate, administeredBy, recordedBy })),
    completedDoseCount: completedHistory.length,
    pendingDoses,
    overdueDoses,
    migrationStatus,
    familyReachability,
    followUpStatus,
  }
}

function makeChild(index) {
  const ageDays = 2 + ((index * 149) % 1_095)
  const dateOfBirth = isoDate(addDays(AS_OF, -ageDays))
  const registrationOffset = (index * 19) % (ageDays + 1)
  const registrationDate = isoDate(addDays(new Date(`${dateOfBirth}T00:00:00Z`), registrationOffset))
  const locality = LOCALITIES[index % LOCALITIES.length]
  const ashaWorker = ASHA_WORKER_NAMES[(index * 5 + Math.floor(index / LOCALITIES.length)) % ASHA_WORKER_NAMES.length]
  const childId = `VXR-${String(index + 1).padStart(4, '0')}`
  const migrationStatus = index % 19 === 7 ? 'Migrated out' : 'Resident'
  const familyReachability = migrationStatus === 'Resident' && index % 17 === 5 ? 'Unreachable' : 'Reachable'

  const vaccinationHistory = []
  const pendingDoses = []
  const overdueDoses = []

  for (const [doseIndex, dose] of VACCINATION_SCHEDULE.entries()) {
    const scheduledDate = isoDate(addDays(new Date(`${dateOfBirth}T00:00:00Z`), dose.dueAfterDays))
    if (scheduledDate > DATA_AS_OF) {
      pendingDoses.push({ ...dose, dueDate: scheduledDate, status: 'Future dose' })
      continue
    }

    const daysAfterDue = Math.floor(seededValue(index, doseIndex + 3) * 18)
    const administeredDate = isoDate(addDays(new Date(`${scheduledDate}T00:00:00Z`), daysAfterDue))
    const administeredBy = ashaWorker
    const shouldHaveDose = seededValue(index + 41, doseIndex + 17) < 0.81

    if (shouldHaveDose && administeredDate <= DATA_AS_OF) {
      vaccinationHistory.push({ ...dose, scheduledDate, administeredDate, administeredBy })
    } else if (scheduledDate < DATA_AS_OF) {
      overdueDoses.push({ ...dose, dueDate: scheduledDate, daysOverdue: Math.floor((AS_OF - new Date(`${scheduledDate}T00:00:00Z`)) / DAY_MS) })
    } else {
      pendingDoses.push({ ...dose, dueDate: scheduledDate, status: 'Due today' })
    }
  }

  const followUpStatus = migrationStatus === 'Migrated out'
    ? 'Migrated'
    : familyReachability === 'Unreachable'
      ? 'Unreachable'
      : overdueDoses.length > 0
        ? 'Immediate follow-up'
        : pendingDoses.length > 0
          ? 'Scheduled'
          : 'Up to date'

  return {
    childId,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${FAMILY_INITIALS[Math.floor(index / FIRST_NAMES.length)]}`,
    dateOfBirth,
    age: ageOn(dateOfBirth),
    ageDays,
    locality,
    assignedAshaWorker: ashaWorker,
    registrationDate,
    vaccinationHistory: vaccinationHistory.sort((a, b) => a.administeredDate.localeCompare(b.administeredDate)),
    completedDoses: vaccinationHistory.map(({ id, name, administeredDate, administeredBy }) => ({ id, name, administeredDate, administeredBy })),
    completedDoseCount: vaccinationHistory.length,
    pendingDoses,
    overdueDoses,
    migrationStatus,
    familyReachability,
    followUpStatus,
  }
}

export const syntheticChildren = Array.from({ length: 120 }, (_, index) => makeChild(index))

// A church-wide auxiliary (program/ministry) that spans campuses. Its per-campus
// instances are groups carrying this id in group.auxiliaryId.
export interface AuxiliaryInterface {
  id?: string;
  churchId?: string;
  name?: string;
  description?: string;
  importKey?: string;
}

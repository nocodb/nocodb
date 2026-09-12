import ActorData from './Actor.json';
import FilmData from './Film.json';
import ProducerData from './Producer.json';
import DvNoEligibleData from './DvNoEligible.json';
import DvFormulaPrimaryData from './DvFormulaPrimary.json';
import DvTitleTakenData from './DvTitleTaken.json';

export const mockResponseData = {
  Actor: ActorData,
  Film: FilmData,
  Producer: ProducerData,

  // display-value fixture (share id `shrDisplayValueMock`)
  DvNoEligible: DvNoEligibleData,
  DvFormulaPrimary: DvFormulaPrimaryData,
  DvTitleTaken: DvTitleTakenData,
};

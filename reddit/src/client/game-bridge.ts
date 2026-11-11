import {navigateTo} from '@devvit/web/client'

/** Lets the game open outside links (Discord, BoardGameGeek) the way Reddit allows. */
;(window as unknown as {SSOpenURL: (url: string) => void}).SSOpenURL = (url: string) => navigateTo(url)

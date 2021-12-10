import axios, { AxiosRequestConfig } from 'axios';

export const BASE_URL = 'https://api.trello.com/1';
const VERSION: string = require('../../package.json').version;

type RequestConfig = AxiosRequestConfig<any> & { isForm?: true };

export default class Trello {
  token: string;

  constructor(token: string) {
    this.token = token;
  }

  async _request(options: RequestConfig) {
    if (!options.url) throw new Error('No URL was provided!');
    if (!options.method) options.method = 'GET';
    if (!options.baseURL) options.baseURL = BASE_URL;
    if (!options.params) options.params = {};
    if (!options.headers) options.headers = {};

    // Query params
    options.params.key = process.env.TRELLO_KEY;
    if (!options.url.startsWith('/tokens')) options.params.token = this.token;

    // Body Format
    if (options.data && options.isForm) {
      const body = new URLSearchParams();
      Object.keys(options.data).forEach((key) => {
        if (options.data[key] !== undefined) body.append(key, options.data[key]);
      });
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.data = body.toString();
    }

    // User Agent
    options.headers[
      'User-Agent'
    ] = `TacoSlashCommands (https://github.com/trello-talk/Taco-Slash-Commands, ${VERSION}) Node.js/${process.version}`;

    const response = await axios(options);
    return response;
  }

  // #region Get methods
  /**
   * Gets the info on a member
   * @param id The member's ID
   * @param boardFilter What type of boards to show
   */
  getMember(id: string, boardFilter: string = 'all') {
    return this._request({
      url: `/members/${id}`,
      params: {
        boards: boardFilter,
        board_fields: ['subscribed', 'starred', 'name', 'shortLink', 'shortUrl', 'closed'],
        boardStars: true
      }
    });
  }

  /**
   * Gets the information on a board
   * @param id The board's ID
   */
  getBoard(id: string) {
    return this._request({
      url: `/boards/${id}`,
      params: {
        fields: [
          'subscribed',
          'starred',
          'pinned',
          'name',
          'desc',
          'prefs',
          'shortLink',
          'shortUrl',
          'powerUps',
          'dateLastActivity',
          'closed',
          'memberships'
        ],
        members: 'all',
        member_fields: ['username', 'fullName', 'memberType'],
        lists: 'all',
        list_fields: ['name', 'subscribed', 'closed', 'pos'],
        cards: 'all',
        card_fields: ['name', 'idList', 'shortLink', 'subscribed', 'closed', 'idLabels', 'due', 'dueComplete'],
        labels: 'all',
        label_fields: ['name', 'color'],
        organization: true
      }
    });
  }

  /**
   * Gets the information on a board, optimized for card search
   * @param id The board's ID
   * @deprecated
   */
  getSlimBoard(id: string) {
    return this._request({
      url: `/boards/${id}`,
      params: {
        fields: ['name'],
        lists: 'all',
        list_fields: ['name', 'closed'],
        cards: 'all',
        card_fields: ['name', 'idList', 'shortLink', 'subscribed', 'closed']
      }
    });
  }

  /**
   * Gets the open lists on a board
   * @param id The board's ID
   * @deprecated
   */
  getLists(id: string) {
    return this._request({
      url: `/boards/${id}/lists`,
      params: {
        cards: 'open',
        card_fields: [],
        fields: ['id', 'name', 'subscribed', 'dateLastActivity']
      }
    });
  }

  /**
   * Gets all cards on a board
   * @param id The board's ID
   * @deprecated
   */
  getAllLists(id: string) {
    return this._request({
      url: `/boards/${id}/lists/all`,
      params: {
        cards: 'open',
        card_fields: ['name', 'subscribed', 'shortLink', 'closed'],
        fields: ['id', 'name', 'subscribed', 'dateLastActivity', 'closed']
      }
    });
  }

  /**
   * Gets the archived lists on a board
   * @param id The board's ID
   * @deprecated
   */
  getListsArchived(id: string) {
    return this._request({
      url: `/boards/${id}/lists`,
      params: {
        filter: 'closed',
        cards: 'open',
        card_fields: ['name', 'subscribed', 'shortLink', 'shortUrl', 'labels']
      }
    });
  }

  /**
   * Gets a card's info
   * @param id The card's ID
   */
  getCard(id: string) {
    return this._request({
      url: `/cards/${id}`,
      params: {
        members: 'true',
        member_fields: ['fullName', 'username'],
        membersVoted: 'true',
        memberVoted_fields: ['fullName', 'username'],
        board: 'true',
        board_fields: ['subscribed', 'name', 'shortLink', 'shortUrl'],
        stickers: 'true',
        sticker_fields: ['image'],
        attachments: 'true',
        attachment_fields: ['url', 'name', 'edgeColor'],
        checklists: 'all',
        checklist_fields: ['name'],
        fields: [
          'name',
          'subscribed',
          'desc',
          'labels',
          'shortLink',
          'shortUrl',
          'due',
          'dueComplete',
          'cover',
          'dateLastActivity',
          'closed',
          'idList',
          'idAttachmentCover'
        ]
      }
    });
  }

  /**
   * Gets the open cards on a board
   * @param id The board's ID
   * @deprecated
   */
  getCards(id: string) {
    return this._request({
      url: `/boards/${id}/cards`,
      params: {
        fields: ['name', 'subscribed', 'shortLink', 'shortUrl', 'labels']
      }
    });
  }

  /**
   * Gets the card ID to list ID pairs
   * @param id The board's ID
   */
  getCardPairs(id: string) {
    return this._request({
      url: `/boards/${id}/cards`,
      params: {
        fields: ['idList']
      }
    });
  }

  /**
   * Gets the archived cards on a board
   * @param {string} id The board's ID
   */
  getCardsArchived(id: string) {
    return this._request({
      url: `/boards/${id}/cards/closed`,
      params: {
        fields: ['name', 'subscribed', 'shortLink', 'shortUrl']
      }
    });
  }

  /**
   * Gets the labels on a board
   * @param {string} id The board's ID
   */
  getLabels(id: string) {
    return this._request({
      url: `/boards/${id}/labels`,
      params: {
        fields: ['name', 'color', 'uses']
      }
    });
  }

  /**
   * Gets the information based on the token
   */
  getToken() {
    return this._request({
      url: `/tokens/${this.token}`
    });
  }

  /**
   * Gets all webhooks for the token
   */
  getWebhooks() {
    return this._request({
      url: `/tokens/${this.token}/webhooks`
    });
  }
  // #endregion

  // #region Post methods
  /**
   * Creates a list on the board.
   * @param {string} id The board's ID
   * @param {string} name The name of the list
   */
  addList(id: string, name: string) {
    return this._request({
      method: 'post',
      url: `/boards/${id}/lists`,
      isForm: true,
      data: { name }
    });
  }

  /**
   * Creates a webhook for Trello.
   * @param {string} id The board's ID
   * @param {Object} payload The webhook to add
   */
  addWebhook(id: string, payload: object) {
    return this._request({
      method: 'post',
      url: `/tokens/${this.token}/webhooks`,
      isForm: true,
      data: {
        idModel: id,
        description: `[${new Date()}] TrelloBot (https://github.com/trello-talk/Taco)`,
        ...payload
      }
    });
  }

  /**
   * Creates a card in the list
   * @param {string} id The list's ID
   * @param {Object} payload The card to add
   */
  addCard(id: string, payload: object) {
    return this._request({
      method: 'post',
      url: '/cards',
      isForm: true,
      data: { ...payload, idList: id }
    });
  }

  /**
   * Creates a label on the board
   * @param {string} id The board's ID
   * @param {Object} payload The card to add
   */
  addLabel(id: string, payload: object) {
    return this._request({
      method: 'post',
      url: '/labels',
      isForm: true,
      data: { ...payload, idBoard: id }
    });
  }

  /**
   * Creates a comment on a card
   * @param {string} id The card's ID
   * @param {string} text The text to post
   */
  addComment(id: string, text: string) {
    return this._request({
      method: 'post',
      url: `/cards/${id}/actions/comments`,
      isForm: true,
      data: { text }
    });
  }

  /**
   * Creates an attachment to a card
   * @param {string} id The card's ID
   * @param {string} url The attachment's URL
   */
  addAttachment(id: string, url: string) {
    return this._request({
      method: 'post',
      url: `/cards/${id}/attachments`,
      isForm: true,
      data: { url }
    });
  }

  /**
   * Creates a star for a board
   * @param {string} id The member's ID
   * @param {string} boardID The board's ID
   * @param {string} [pos='top'] The position of the star
   */
  starBoard(id: string, boardID: string, pos: string = 'top') {
    return this._request({
      method: 'post',
      url: `/members/${id}/boardStars`,
      isForm: true,
      data: { idBoard: boardID, pos }
    });
  }
  // #endregion

  // #region Put methods
  /**
   * Updates a label.
   * @param {string} id The label's ID
   * @param {Object} payload The data to use
   */
  updateLabel(id: string, payload: object) {
    return this._request({
      method: 'put',
      url: `/labels/${id}`,
      isForm: true,
      data: payload
    });
  }

  /**
   * Updates a board
   * @param {string} id The board's ID
   * @param {Object} payload The data to use
   */
  updateBoard(id: string, payload: object) {
    return this._request({
      method: 'put',
      url: `/boards/${id}`,
      isForm: true,
      data: payload
    });
  }

  /**
   * Updates a list.
   * @param {string} id The list's ID
   * @param {Object} payload The data to use
   */
  updateList(id: string, payload: object) {
    return this._request({
      method: 'put',
      url: `/lists/${id}`,
      isForm: true,
      data: payload
    });
  }

  /**
   * Updates a card.
   * @param {string} id The card's ID
   * @param {Object} payload The data to use
   */
  updateCard(id: string, payload: object) {
    return this._request({
      method: 'put',
      url: `/cards/${id}`,
      isForm: true,
      data: payload
    });
  }

  /**
   * Updates a card's attachment.
   * @param {string} cardID The card's ID
   * @param {string} id The attachment's ID
   * @param {Object} payload The data to use
   */
  updateAttachment(cardID: string, id: string, payload: object) {
    return this._request({
      method: 'put',
      url: `/cards/${cardID}/attachments/${id}`,
      isForm: true,
      data: payload
    });
  }

  /**
   * Updates a webhook.
   * @param {string} id The webhook's ID
   * @param {Object} payload The data to use
   */
  updateWebhook(id: string, payload: object) {
    return this._request({
      method: 'put',
      url: `/webhooks/${id}`,
      isForm: true,
      data: payload
    });
  }
  // #endregion

  // #region Delete methods
  /**
   * Deletes a label.
   * @param {string} id The label's ID
   */
  deleteLabel(id: string) {
    return this._request({
      method: 'delete',
      url: `/labels/${id}`
    });
  }

  /**
   * Deletes a card.
   * @param {string} id The card's ID
   */
  deleteCard(id: string) {
    return this._request({
      method: 'delete',
      url: `/cards/${id}`
    });
  }

  /**
   * Deletes a card's attachment.
   * @param {string} cardID The card's ID
   * @param {string} id The attachment's ID
   */
  deleteAttachment(cardID: string, id: string) {
    return this._request({
      method: 'delete',
      url: `/cards/${cardID}/attachments/${id}`
    });
  }

  /**
   * Deletes a webhook.
   * @param {string} id The webhook's ID
   */
  deleteWebhook(id: string) {
    return this._request({
      method: 'delete',
      url: `/tokens/${this.token}/webhooks/${id}`
    });
  }

  /**
   * Removs a star for a board
   * @param {string} id The member's ID
   * @param {string} starID The board star's ID
   */
  unstarBoard(id: string, starID: string) {
    return this._request({
      method: 'delete',
      url: `/members/${id}/boardStars/${starID}`
    });
  }
  // #endregion

  /**
   * Invalidates the token given.
   */
  invalidate() {
    return this._request({
      method: 'delete',
      url: `/tokens/${this.token}`
    });
  }
}

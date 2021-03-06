/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {MDCComponent} from '@material/base/component';
import {SpecificEventListener} from '@material/base/types';
import {closest, matches} from '@material/dom/ponyfill';
import {MDCRipple} from '@material/ripple/component';
import {FocusTrap} from 'focus-trap';
import {MDCDialogAdapter} from './adapter';
import {MDCDialogFoundation} from './foundation';
import {MDCDialogCloseEventDetail} from './types';
import * as util from './util';
import {MDCDialogFocusTrapFactory} from './util';

const {strings} = MDCDialogFoundation;

export class MDCDialog extends MDCComponent<MDCDialogFoundation> {
  get isOpen() {
    return this.foundation_.isOpen();
  }

  get escapeKeyAction() {
    return this.foundation_.getEscapeKeyAction();
  }

  set escapeKeyAction(action) {
    this.foundation_.setEscapeKeyAction(action);
  }

  get scrimClickAction() {
    return this.foundation_.getScrimClickAction();
  }

  set scrimClickAction(action) {
    this.foundation_.setScrimClickAction(action);
  }

  get autoStackButtons() {
    return this.foundation_.getAutoStackButtons();
  }

  set autoStackButtons(autoStack) {
    this.foundation_.setAutoStackButtons(autoStack);
  }

  static attachTo(root: Element) {
    return new MDCDialog(root);
  }

  private buttonRipples_!: MDCRipple[]; // assigned in initialize()
  private buttons_!: HTMLElement[]; // assigned in initialize()
  private container_!: HTMLElement; // assigned in initialize()
  private content_!: HTMLElement | null; // assigned in initialize()
  private defaultButton_!: HTMLElement | null; // assigned in initialize()
  private initialFocusEl_?: HTMLElement; // assigned in initialize()

  private focusTrap_!: FocusTrap; // assigned in initialSyncWithDOM()
  private focusTrapFactory_?: MDCDialogFocusTrapFactory; // assigned in initialize()

  private handleInteraction_!: SpecificEventListener<'click' | 'keydown'>; // assigned in initialSyncWithDOM()
  private handleDocumentKeydown_!: SpecificEventListener<'keydown'>; // assigned in initialSyncWithDOM()
  private handleLayout_!: EventListener; // assigned in initialSyncWithDOM()
  private handleOpening_!: EventListener; // assigned in initialSyncWithDOM()
  private handleClosing_!: () => void; // assigned in initialSyncWithDOM()

  initialize(
      focusTrapFactory?: MDCDialogFocusTrapFactory,
      initialFocusEl?: HTMLElement,
  ) {
    const container = this.root_.querySelector<HTMLElement>(strings.CONTAINER_SELECTOR);
    if (!container) {
      throw new Error(`Dialog component requires a ${strings.CONTAINER_SELECTOR} container element`);
    }
    this.container_ = container;
    this.content_ = this.root_.querySelector<HTMLElement>(strings.CONTENT_SELECTOR);
    this.buttons_ = [].slice.call(this.root_.querySelectorAll<HTMLElement>(strings.BUTTON_SELECTOR));
    this.defaultButton_ = this.root_.querySelector<HTMLElement>(strings.DEFAULT_BUTTON_SELECTOR);
    this.focusTrapFactory_ = focusTrapFactory;
    this.initialFocusEl_ = initialFocusEl;
    this.buttonRipples_ = [];

    for (const buttonEl of this.buttons_) {
      this.buttonRipples_.push(new MDCRipple(buttonEl));
    }
  }

  initialSyncWithDOM() {
    this.focusTrap_ = util.createFocusTrapInstance(this.container_, this.focusTrapFactory_, this.initialFocusEl_);

    this.handleInteraction_ = this.foundation_.handleInteraction.bind(this.foundation_);
    this.handleDocumentKeydown_ = this.foundation_.handleDocumentKeydown.bind(this.foundation_);
    this.handleLayout_ = this.layout.bind(this);

    const LAYOUT_EVENTS = ['resize', 'orientationchange'];
    this.handleOpening_ = () => {
      LAYOUT_EVENTS.forEach((evtType) => window.addEventListener(evtType, this.handleLayout_));
      document.addEventListener('keydown', this.handleDocumentKeydown_);
    };
    this.handleClosing_ = () => {
      LAYOUT_EVENTS.forEach((evtType) => window.removeEventListener(evtType, this.handleLayout_));
      document.removeEventListener('keydown', this.handleDocumentKeydown_);
    };

    this.listen('click', this.handleInteraction_);
    this.listen('keydown', this.handleInteraction_);
    this.listen(strings.OPENING_EVENT, this.handleOpening_);
    this.listen(strings.CLOSING_EVENT, this.handleClosing_);
  }

  destroy() {
    this.unlisten('click', this.handleInteraction_);
    this.unlisten('keydown', this.handleInteraction_);
    this.unlisten(strings.OPENING_EVENT, this.handleOpening_);
    this.unlisten(strings.CLOSING_EVENT, this.handleClosing_);
    this.handleClosing_();

    this.buttonRipples_.forEach((ripple) => ripple.destroy());
    super.destroy();
  }

  layout() {
    this.foundation_.layout();
  }

  open() {
    this.foundation_.open();
  }

  close(action = '') {
    this.foundation_.close(action);
  }

  getDefaultFoundation() {
    // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
    // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
    const adapter: MDCDialogAdapter = {
      addBodyClass: (className) => document.body.classList.add(className),
      addClass: (className) => this.root_.classList.add(className),
      areButtonsStacked: () => util.areTopsMisaligned(this.buttons_),
      clickDefaultButton: () => this.defaultButton_ && this.defaultButton_.click(),
      eventTargetMatches: (target, selector) => target ? matches(target as Element, selector) : false,
      getActionFromEvent: (evt: Event) => {
        if (!evt.target) {
          return '';
        }
        const element = closest(evt.target as Element, `[${strings.ACTION_ATTRIBUTE}]`);
        return element && element.getAttribute(strings.ACTION_ATTRIBUTE);
      },
      hasClass: (className) => this.root_.classList.contains(className),
      isContentScrollable: () => util.isScrollable(this.content_),
      notifyClosed: (action) => this.emit<MDCDialogCloseEventDetail>(strings.CLOSED_EVENT, action ? {action} : {}),
      notifyClosing: (action) => this.emit<MDCDialogCloseEventDetail>(strings.CLOSING_EVENT, action ? {action} : {}),
      notifyOpened: () => this.emit(strings.OPENED_EVENT, {}),
      notifyOpening: () => this.emit(strings.OPENING_EVENT, {}),
      releaseFocus: () => this.focusTrap_.deactivate(),
      removeBodyClass: (className) => document.body.classList.remove(className),
      removeClass: (className) => this.root_.classList.remove(className),
      reverseButtons: () => {
        this.buttons_.reverse();
        this.buttons_.forEach((button) => {
          button.parentElement!.appendChild(button);
        });
      },
      trapFocus: () => this.focusTrap_.activate(),
    };
    return new MDCDialogFoundation(adapter);
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ButtonModule,
  CardModule,
  AlertModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-container-tracking',
  standalone: true,
  imports: [
    CommonModule,
    IconDirective,
    ButtonModule,
    CardModule,
    AlertModule
  ],
  templateUrl: './container-tracking.component.html',
  styleUrls: ['./container-tracking.component.scss']
})
export class ContainerTrackingComponent {
  
  constructor() {}

}
